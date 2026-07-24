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
import { fitDualMeanderAttemptPlan } from "./planning/fitDualMeanderAttemptPlan"
import { getDualMeanderAttemptPlans } from "./planning/getDualMeanderAttemptPlans"

/** Two meanders whose added lengths cancel the original pair mismatch. */
export type DualMeanderPlan = {
  longerAttempts: NonEmptyValidAttempts
  shorterAttempts: NonEmptyValidAttempts
}

export type NonEmptyValidAttempts = [
  ValidRegressionAttempt,
  ...ValidRegressionAttempt[],
]

export type DualMeanderPlanInput = {
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

export type MinimumAttempt = {
  candidate: SegmentCandidate
  attempt: ValidRegressionAttempt
}

export type MinimumAttemptPlan = {
  attempts: MinimumAttempt[]
  attemptOptions: MinimumAttempt[][]
  minimumAddedLength: number
  maximumAddedLength: number
  rankingQualityScore: number
}

export type FittedAttemptPlan = {
  attempts: NonEmptyValidAttempts
  routes: HighDensityRoute[]
  addedLength: number
}

type RankedPairCursor = {
  leftIndex: number
  rightIndex: number
  rankingQualityScore: number
}

/** Find and jointly validate an atomic two-connection length-matching plan. */
export const selectDualMeanderPlan = (
  input: DualMeanderPlanInput,
): DualMeanderPlan | null => {
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
      | "lengthTolerance"
      | "obstacles"
      | "bounds"
      | "layerCount"
      | "obstacleMargin"
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
  const longerPlans = getDualMeanderAttemptPlans(longerMinimumAttempts)
  const shorterPlans = getDualMeanderAttemptPlans(shorterMinimumAttempts)
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
    const longerPlan = fitDualMeanderAttemptPlan({
      plan: longerMinimumPlan,
      targetAddedLength: longerTargetAddedLength,
      routes: input.routes,
      connectionName: input.longerConnectionName,
      excludedConnectionName: input.shorterConnectionName,
      config: { ...config, lengthTolerance: input.lengthTolerance },
    })
    if (!longerPlan) continue
    const shorterPlan = fitDualMeanderAttemptPlan({
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
