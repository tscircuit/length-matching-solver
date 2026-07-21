import type { HighDensityRoute, Obstacle, RoutePoint } from "../types"
import {
  findConnectionRouteIndexes,
  getConnectionLength,
  getLogicalConnectionName,
} from "./connection-routes"
import { isCandidateGeometryValid } from "./geometry-validation"
import type {
  RegressionAttempt,
  SegmentCandidate,
  ValidRegressionAttempt,
} from "./internal-types"
import {
  evaluateMeanderCandidate,
  evaluateMinimumMeanderCandidate,
} from "./meander-candidate"
import { getMeanderPlanQualityScore } from "./multi-segment-plan"

/** Two meanders whose added lengths cancel the original pair mismatch. */
export type DualMeanderPlan = {
  longerAttempts: NonEmptyValidAttempts
  shorterAttempts: NonEmptyValidAttempts
}

type NonEmptyValidAttempts = [
  ValidRegressionAttempt,
  ...ValidRegressionAttempt[],
]

type DualMeanderPlanInput = {
  routes: HighDensityRoute[]
  longerConnectionName: string
  shorterConnectionName: string
  originalLengthDifference: number
  lengthTolerance: number
  longerCandidates: SegmentCandidate[]
  shorterCandidates: SegmentCandidate[]
  obstacles: Obstacle[]
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  obstacleMargin: number
}

type MinimumAttempt = {
  candidate: SegmentCandidate
  attempt: ValidRegressionAttempt
}

type MinimumAttemptPlan = {
  attempts: MinimumAttempt[]
  attemptOptions: MinimumAttempt[][]
  minimumAddedLength: number
  maximumAddedLength: number
  rankingQualityScore: number
}

type FittedAttemptPlan = {
  attempts: NonEmptyValidAttempts
  routes: HighDensityRoute[]
  addedLength: number
}

type RankedPairCursor = {
  leftIndex: number
  rightIndex: number
  rankingQualityScore: number
}

const hasHigherCursorPriority = (
  left: RankedPairCursor,
  right: RankedPairCursor,
): boolean => {
  if (left.rankingQualityScore !== right.rankingQualityScore)
    return left.rankingQualityScore > right.rankingQualityScore
  if (left.leftIndex !== right.leftIndex)
    return left.leftIndex < right.leftIndex
  return left.rightIndex < right.rightIndex
}

const pushRankedPairCursor = (
  heap: RankedPairCursor[],
  cursor: RankedPairCursor,
): void => {
  heap.push(cursor)
  let index = heap.length - 1
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2)
    const parent = heap[parentIndex]!
    if (hasHigherCursorPriority(parent, cursor)) break
    heap[index] = parent
    index = parentIndex
  }
  heap[index] = cursor
}

const popRankedPairCursor = (
  heap: RankedPairCursor[],
): RankedPairCursor | undefined => {
  const first = heap[0]
  const last = heap.pop()
  if (!first || !last || heap.length === 0) return first
  let index = 0
  while (true) {
    const leftIndex = index * 2 + 1
    const rightIndex = leftIndex + 1
    if (leftIndex >= heap.length) break
    const higherChildIndex =
      rightIndex < heap.length &&
      hasHigherCursorPriority(heap[rightIndex]!, heap[leftIndex]!)
        ? rightIndex
        : leftIndex
    const higherChild = heap[higherChildIndex]!
    if (hasHigherCursorPriority(last, higherChild)) break
    heap[index] = higherChild
    index = higherChildIndex
  }
  heap[index] = last
  return first
}

const getRankedOptionPairs = function* <Left, Right>(input: {
  leftOptions: Left[]
  rightOptions: Right[]
  getLeftQualityScore: (option: Left) => number
  getRightQualityScore: (option: Right) => number
}): Generator<readonly [Left, Right]> {
  const leftOptions = [...input.leftOptions].sort(
    (left, right) =>
      input.getLeftQualityScore(right) - input.getLeftQualityScore(left),
  )
  const rightOptions = [...input.rightOptions].sort(
    (left, right) =>
      input.getRightQualityScore(right) - input.getRightQualityScore(left),
  )
  const heap: RankedPairCursor[] = []
  for (let leftIndex = 0; leftIndex < leftOptions.length; leftIndex++) {
    const right = rightOptions[0]
    if (!right) break
    pushRankedPairCursor(heap, {
      leftIndex,
      rightIndex: 0,
      rankingQualityScore:
        (input.getLeftQualityScore(leftOptions[leftIndex]!) +
          input.getRightQualityScore(right)) /
        2,
    })
  }
  while (heap.length > 0) {
    const cursor = popRankedPairCursor(heap)!
    yield [leftOptions[cursor.leftIndex]!, rightOptions[cursor.rightIndex]!]
    const nextRightIndex = cursor.rightIndex + 1
    const nextRight = rightOptions[nextRightIndex]
    if (!nextRight) continue
    pushRankedPairCursor(heap, {
      leftIndex: cursor.leftIndex,
      rightIndex: nextRightIndex,
      rankingQualityScore:
        (input.getLeftQualityScore(leftOptions[cursor.leftIndex]!) +
          input.getRightQualityScore(nextRight)) /
        2,
    })
  }
}

const replaceAttemptRoute = (
  routes: HighDensityRoute[],
  attempt: RegressionAttempt,
): HighDensityRoute[] => {
  const route = routes[attempt.routeIndex]
  if (!route)
    throw new Error(
      `LengthMatchingSolver: dual meander references missing route ${attempt.routeIndex}`,
    )
  const updatedRoutes = [...routes]
  updatedRoutes[attempt.routeIndex] = {
    ...route,
    route: attempt.predictedRoute,
  }
  return updatedRoutes
}

const isAttemptGeometryValid = (input: {
  attempt: RegressionAttempt
  routes: HighDensityRoute[]
  config: Pick<
    DualMeanderPlanInput,
    "obstacles" | "bounds" | "layerCount" | "obstacleMargin"
  >
}): boolean => {
  const route = input.routes[input.attempt.routeIndex]
  if (!route)
    throw new Error(
      `LengthMatchingSolver: cannot validate missing dual-meander route ${input.attempt.routeIndex}`,
    )
  return isCandidateGeometryValid({
    route,
    meanderPoints: input.attempt.meanderPoints,
    routedRoutes: input.routes,
    ...input.config,
  })
}

const getMinimumAttempts = (input: {
  candidates: SegmentCandidate[]
  routes: HighDensityRoute[]
  connectionName: string
  counterpartConnectionName: string
  config: Pick<
    DualMeanderPlanInput,
    "lengthTolerance" | "obstacles" | "bounds" | "layerCount" | "obstacleMargin"
  >
}): MinimumAttempt[] => {
  const routesWithoutCounterpart = input.routes.filter(
    (route) =>
      getLogicalConnectionName(route) !== input.counterpartConnectionName,
  )
  const attempts: MinimumAttempt[] = []
  for (const candidate of input.candidates) {
    const route = input.routes[candidate.routeIndex]
    if (!route)
      throw new Error(
        `LengthMatchingSolver: dual-meander candidate references missing route ${candidate.routeIndex}`,
      )
    const attempt = evaluateMinimumMeanderCandidate({
      candidate,
      route,
      connectionName: input.connectionName,
      lengthTolerance: input.config.lengthTolerance,
      isGeometryValid: (meanderPoints: RoutePoint[]) =>
        isCandidateGeometryValid({
          route,
          meanderPoints,
          routedRoutes: routesWithoutCounterpart,
          ...input.config,
        }),
    })
    if (attempt) attempts.push({ candidate, attempt })
  }
  return attempts
}

const getMinimumAttemptStyleKey = (minimumAttempt: MinimumAttempt): string =>
  [
    minimumAttempt.candidate.toothCount,
    minimumAttempt.candidate.placement,
    minimumAttempt.candidate.heightProfile,
  ].join(":")

const getAttemptPlans = (
  minimumAttempts: MinimumAttempt[],
): MinimumAttemptPlan[] => {
  const attemptsByStyle = new Map<string, Map<string, MinimumAttempt[]>>()
  for (const minimumAttempt of minimumAttempts) {
    const styleKey = getMinimumAttemptStyleKey(minimumAttempt)
    const segmentKey = `${minimumAttempt.candidate.routeIndex}:${minimumAttempt.candidate.segmentIndex}`
    const attemptsBySegment = attemptsByStyle.get(styleKey)
    if (!attemptsBySegment) {
      attemptsByStyle.set(styleKey, new Map([[segmentKey, [minimumAttempt]]]))
      continue
    }
    const segmentAttempts = attemptsBySegment.get(segmentKey)
    if (segmentAttempts) segmentAttempts.push(minimumAttempt)
    else attemptsBySegment.set(segmentKey, [minimumAttempt])
  }
  const plans: MinimumAttemptPlan[] = []
  for (const attemptsBySegment of attemptsByStyle.values()) {
    const segmentOptions = [...attemptsBySegment.values()]
      .map((attempts) => ({
        attempts,
        maximumAddedLength: Math.max(
          ...attempts.map((attempt) => attempt.attempt.maximumAddedLength),
        ),
        minimumAddedLength: Math.min(
          ...attempts.map((attempt) => attempt.attempt.addedLength),
        ),
        rankingAttempt: attempts.reduce((bestAttempt, attempt) =>
          attempt.attempt.qualityScore > bestAttempt.attempt.qualityScore
            ? attempt
            : bestAttempt,
        ),
      }))
      .sort((left, right) => right.maximumAddedLength - left.maximumAddedLength)
    for (const segmentOption of segmentOptions) {
      plans.push({
        attempts: [segmentOption.rankingAttempt],
        attemptOptions: [segmentOption.attempts],
        minimumAddedLength: segmentOption.minimumAddedLength,
        maximumAddedLength: segmentOption.maximumAddedLength,
        rankingQualityScore: segmentOption.rankingAttempt.attempt.qualityScore,
      })
    }
    for (
      let segmentCount = 2;
      segmentCount <= segmentOptions.length;
      segmentCount++
    ) {
      const selectedOptions = segmentOptions.slice(0, segmentCount)
      const attempts = selectedOptions.map((options) => options.rankingAttempt)
      plans.push({
        attempts,
        attemptOptions: selectedOptions.map((options) => options.attempts),
        minimumAddedLength: selectedOptions.reduce(
          (total, options) => total + options.minimumAddedLength,
          0,
        ),
        maximumAddedLength: selectedOptions.reduce(
          (total, options) => total + options.maximumAddedLength,
          0,
        ),
        rankingQualityScore: getMeanderPlanQualityScore(
          attempts.map((attempt) => attempt.attempt),
        ),
      })
    }
  }
  return plans
}

const distributeAttemptTargets = (input: {
  plan: MinimumAttemptPlan
  targetAddedLength: number
  lengthTolerance: number
}): number[] | null => {
  if (
    input.targetAddedLength + input.lengthTolerance <
      input.plan.minimumAddedLength ||
    input.targetAddedLength - input.lengthTolerance >
      input.plan.maximumAddedLength
  )
    return null
  const targets = input.plan.attemptOptions.map((attempts) =>
    Math.min(...attempts.map((attempt) => attempt.attempt.addedLength)),
  )
  let remaining = Math.max(
    0,
    input.targetAddedLength - input.plan.minimumAddedLength,
  )
  let activeIndexes = targets.map((_, index) => index)
  while (remaining > 1e-9 && activeIndexes.length > 0) {
    const share = remaining / activeIndexes.length
    let distributed = 0
    const nextActiveIndexes: number[] = []
    for (const index of activeIndexes) {
      const capacity =
        Math.max(
          ...input.plan.attemptOptions[index]!.map(
            (attempt) => attempt.attempt.maximumAddedLength,
          ),
        ) - targets[index]!
      const added = Math.min(capacity, share)
      targets[index]! += added
      distributed += added
      if (capacity - added > 1e-9) nextActiveIndexes.push(index)
    }
    if (distributed <= 1e-9) break
    remaining -= distributed
    activeIndexes = nextActiveIndexes
  }
  return remaining <= input.lengthTolerance ? targets : null
}

const fitAttemptPlan = (input: {
  plan: MinimumAttemptPlan
  targetAddedLength: number
  routes: HighDensityRoute[]
  connectionName: string
  excludedConnectionName?: string
  config: Pick<
    DualMeanderPlanInput,
    "lengthTolerance" | "obstacles" | "bounds" | "layerCount" | "obstacleMargin"
  >
}): FittedAttemptPlan | null => {
  const targets = distributeAttemptTargets({
    plan: input.plan,
    targetAddedLength: input.targetAddedLength,
    lengthTolerance: input.config.lengthTolerance,
  })
  if (!targets) return null
  const plannedAttempts = input.plan.attemptOptions
    .map((attemptOptions, index) => ({
      attemptOptions,
      targetAddedLength: targets[index]!,
    }))
    .sort(
      (left, right) =>
        right.attemptOptions[0]!.candidate.routeIndex -
          left.attemptOptions[0]!.candidate.routeIndex ||
        right.attemptOptions[0]!.candidate.segmentIndex -
          left.attemptOptions[0]!.candidate.segmentIndex,
    )
  let routes = [...input.routes]
  const attempts: ValidRegressionAttempt[] = []
  for (const plannedAttempt of plannedAttempts) {
    const firstCandidate = plannedAttempt.attemptOptions[0]?.candidate
    if (!firstCandidate)
      throw new Error(
        "LengthMatchingSolver: empty dual-meander segment options",
      )
    const route = routes[firstCandidate.routeIndex]
    if (!route)
      throw new Error(
        `LengthMatchingSolver: missing planned dual-meander route ${firstCandidate.routeIndex}`,
      )
    let selectedAttempt: ValidRegressionAttempt | null = null
    for (const minimumAttempt of plannedAttempt.attemptOptions) {
      if (
        minimumAttempt.attempt.addedLength - input.config.lengthTolerance >
          plannedAttempt.targetAddedLength ||
        minimumAttempt.attempt.maximumAddedLength +
          input.config.lengthTolerance <
          plannedAttempt.targetAddedLength
      )
        continue
      const attempt = evaluateMeanderCandidate({
        candidate: minimumAttempt.candidate,
        route,
        connectionName: input.connectionName,
        targetAddedLength: plannedAttempt.targetAddedLength,
        lengthTolerance: input.config.lengthTolerance,
        isGeometryValid: (meanderPoints) =>
          isCandidateGeometryValid({
            route,
            meanderPoints,
            routedRoutes: input.excludedConnectionName
              ? routes.filter(
                  (routedRoute) =>
                    getLogicalConnectionName(routedRoute) !==
                    input.excludedConnectionName,
                )
              : routes,
            ...input.config,
          }),
      })
      if (
        attempt.valid &&
        (!selectedAttempt ||
          attempt.qualityScore > selectedAttempt.qualityScore)
      )
        selectedAttempt = attempt
    }
    if (!selectedAttempt) return null
    routes = replaceAttemptRoute(routes, selectedAttempt)
    attempts.push(selectedAttempt)
  }
  const addedLength = attempts.reduce(
    (total, attempt) => total + attempt.addedLength,
    0,
  )
  if (
    Math.abs(addedLength - input.targetAddedLength) >
    input.config.lengthTolerance
  )
    return null
  const firstAttempt = attempts[0]
  if (!firstAttempt)
    throw new Error("LengthMatchingSolver: fitted an empty dual-meander plan")
  return {
    attempts: [firstAttempt, ...attempts.slice(1)],
    routes,
    addedLength,
  }
}

/** Find and jointly validate an atomic two-connection length-matching plan. */
export const selectDualMeanderPlan = (
  input: DualMeanderPlanInput,
): DualMeanderPlan | null => {
  const config = {
    obstacles: input.obstacles,
    bounds: input.bounds,
    layerCount: input.layerCount,
    obstacleMargin: input.obstacleMargin,
  }
  const shorterMinimumAttempts = getMinimumAttempts({
    candidates: input.shorterCandidates,
    routes: input.routes,
    connectionName: input.shorterConnectionName,
    counterpartConnectionName: input.longerConnectionName,
    config: { ...config, lengthTolerance: input.lengthTolerance },
  })
  if (shorterMinimumAttempts.length === 0) return null
  const longerMinimumAttempts = getMinimumAttempts({
    candidates: input.longerCandidates,
    routes: input.routes,
    connectionName: input.longerConnectionName,
    counterpartConnectionName: input.shorterConnectionName,
    config: { ...config, lengthTolerance: input.lengthTolerance },
  })
  const rankedCandidatePairs = getRankedOptionPairs({
    leftOptions: longerMinimumAttempts,
    rightOptions: shorterMinimumAttempts,
    getLeftQualityScore: (minimumAttempt) =>
      minimumAttempt.attempt.qualityScore,
    getRightQualityScore: (minimumAttempt) =>
      minimumAttempt.attempt.qualityScore,
  })
  for (const [longerMinimum, shorterMinimum] of rankedCandidatePairs) {
    const longerTargetAddedLength = Math.max(
      longerMinimum.attempt.addedLength,
      shorterMinimum.attempt.addedLength - input.originalLengthDifference,
    )
    const shorterTargetAddedLength =
      longerTargetAddedLength + input.originalLengthDifference
    if (
      longerTargetAddedLength - input.lengthTolerance >
        longerMinimum.attempt.maximumAddedLength ||
      shorterTargetAddedLength - input.lengthTolerance >
        shorterMinimum.attempt.maximumAddedLength
    )
      continue
    const longerRoute = input.routes[longerMinimum.candidate.routeIndex]
    if (!longerRoute)
      throw new Error(
        `LengthMatchingSolver: missing longer route ${longerMinimum.candidate.routeIndex}`,
      )
    const shorterRoute = input.routes[shorterMinimum.candidate.routeIndex]
    if (!shorterRoute)
      throw new Error(
        `LengthMatchingSolver: missing shorter route ${shorterMinimum.candidate.routeIndex}`,
      )
    const routesWithoutShorter = input.routes.filter(
      (route) =>
        getLogicalConnectionName(route) !== input.shorterConnectionName,
    )
    const longerAttempt = evaluateMeanderCandidate({
      candidate: longerMinimum.candidate,
      route: longerRoute,
      connectionName: input.longerConnectionName,
      targetAddedLength: longerTargetAddedLength,
      lengthTolerance: input.lengthTolerance,
      isGeometryValid: (meanderPoints) =>
        isCandidateGeometryValid({
          route: longerRoute,
          meanderPoints,
          routedRoutes: routesWithoutShorter,
          ...config,
        }),
    })
    if (
      !longerAttempt.valid ||
      Math.abs(longerAttempt.addedLength - longerTargetAddedLength) >
        input.lengthTolerance
    )
      continue
    const routesWithLonger = replaceAttemptRoute(input.routes, longerAttempt)
    const fittedShorterTargetAddedLength =
      longerAttempt.addedLength + input.originalLengthDifference
    const shorterAttempt = evaluateMeanderCandidate({
      candidate: shorterMinimum.candidate,
      route: shorterRoute,
      connectionName: input.shorterConnectionName,
      targetAddedLength: fittedShorterTargetAddedLength,
      lengthTolerance: input.lengthTolerance,
      isGeometryValid: (meanderPoints) =>
        isCandidateGeometryValid({
          route: shorterRoute,
          meanderPoints,
          routedRoutes: routesWithLonger,
          ...config,
        }),
    })
    if (!shorterAttempt.valid) continue
    const finalRoutes = replaceAttemptRoute(routesWithLonger, shorterAttempt)
    const longerRouteIndexes = findConnectionRouteIndexes(
      finalRoutes,
      input.longerConnectionName,
    )
    const shorterRouteIndexes = findConnectionRouteIndexes(
      finalRoutes,
      input.shorterConnectionName,
    )
    const measuredDifference = Math.abs(
      getConnectionLength(finalRoutes, shorterRouteIndexes) -
        getConnectionLength(finalRoutes, longerRouteIndexes),
    )
    if (
      measuredDifference > input.lengthTolerance ||
      !isAttemptGeometryValid({
        attempt: longerAttempt,
        routes: finalRoutes,
        config,
      }) ||
      !isAttemptGeometryValid({
        attempt: shorterAttempt,
        routes: finalRoutes,
        config,
      })
    )
      continue
    return {
      longerAttempts: [longerAttempt],
      shorterAttempts: [shorterAttempt],
    }
  }
  const longerPlans = getAttemptPlans(longerMinimumAttempts)
  const shorterPlans = getAttemptPlans(shorterMinimumAttempts)
  const rankedAttemptPlanPairs = getRankedOptionPairs({
    leftOptions: longerPlans,
    rightOptions: shorterPlans,
    getLeftQualityScore: (plan) => plan.rankingQualityScore,
    getRightQualityScore: (plan) => plan.rankingQualityScore,
  })
  for (const [
    longerMinimumPlan,
    shorterMinimumPlan,
  ] of rankedAttemptPlanPairs) {
    if (
      longerMinimumPlan.attempts.length === 1 &&
      shorterMinimumPlan.attempts.length === 1
    )
      continue
    const longerTargetAddedLength = Math.max(
      longerMinimumPlan.minimumAddedLength,
      shorterMinimumPlan.minimumAddedLength - input.originalLengthDifference,
    )
    const shorterTargetAddedLength =
      longerTargetAddedLength + input.originalLengthDifference
    if (
      longerTargetAddedLength - input.lengthTolerance >
        longerMinimumPlan.maximumAddedLength ||
      shorterTargetAddedLength - input.lengthTolerance >
        shorterMinimumPlan.maximumAddedLength
    )
      continue
    const longerPlan = fitAttemptPlan({
      plan: longerMinimumPlan,
      targetAddedLength: longerTargetAddedLength,
      routes: input.routes,
      connectionName: input.longerConnectionName,
      excludedConnectionName: input.shorterConnectionName,
      config: { ...config, lengthTolerance: input.lengthTolerance },
    })
    if (!longerPlan) continue
    const shorterPlan = fitAttemptPlan({
      plan: shorterMinimumPlan,
      targetAddedLength:
        longerPlan.addedLength + input.originalLengthDifference,
      routes: longerPlan.routes,
      connectionName: input.shorterConnectionName,
      config: { ...config, lengthTolerance: input.lengthTolerance },
    })
    if (!shorterPlan) continue
    const longerRouteIndexes = findConnectionRouteIndexes(
      shorterPlan.routes,
      input.longerConnectionName,
    )
    const shorterRouteIndexes = findConnectionRouteIndexes(
      shorterPlan.routes,
      input.shorterConnectionName,
    )
    const measuredDifference = Math.abs(
      getConnectionLength(shorterPlan.routes, shorterRouteIndexes) -
        getConnectionLength(shorterPlan.routes, longerRouteIndexes),
    )
    const allAttempts = [...longerPlan.attempts, ...shorterPlan.attempts]
    if (
      measuredDifference > input.lengthTolerance ||
      allAttempts.some(
        (attempt) =>
          !isAttemptGeometryValid({
            attempt,
            routes: shorterPlan.routes,
            config,
          }),
      )
    )
      continue
    return {
      longerAttempts: longerPlan.attempts,
      shorterAttempts: shorterPlan.attempts,
    }
  }
  return null
}
