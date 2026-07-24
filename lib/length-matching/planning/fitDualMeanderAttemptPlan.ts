import type { HighDensityRoute } from "../../types"
import type {
  DualMeanderPlanInput,
  FittedAttemptPlan,
  MinimumAttemptPlan,
} from "../dual-meander-plan"
import { getLogicalConnectionName } from "../connection-routes"
import { isCandidateGeometryValid } from "../geometry-validation"
import type {
  RegressionAttempt,
  ValidRegressionAttempt,
} from "../internal-types"
import { evaluateMeanderCandidate } from "../meander-candidate"

export const fitDualMeanderAttemptPlan = (input: {
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
  const distributeAttemptTargets = (): number[] | null => {
    if (
      input.targetAddedLength + input.config.lengthTolerance <
        input.plan.minimumAddedLength ||
      input.targetAddedLength - input.config.lengthTolerance >
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
    return remaining <= input.config.lengthTolerance ? targets : null
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
  const targets = distributeAttemptTargets()
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
