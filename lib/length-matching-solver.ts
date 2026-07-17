import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import {
  validateAndResolveParams,
  validatePair,
} from "./length-matching/config"
import {
  findConnectionRouteIndexes,
  getConnectionLength,
} from "./length-matching/connection-routes"
import { isCandidateGeometryValid } from "./length-matching/geometry-validation"
import type {
  ActivePair,
  LengthMatchingConfig,
  RegressionAttempt,
} from "./length-matching/internal-types"
import {
  createMeanderCandidates,
  evaluateMeanderCandidate,
} from "./length-matching/meander-candidate"
import {
  getMeanderPlanQualityScore,
  getPlannedAttemptTargets,
  getRegressionAttemptKey,
  selectPartialMeanderPlan,
} from "./length-matching/multi-segment-plan"
import type {
  LengthMatchingSolverOutput,
  LengthMatchingSolverParams,
} from "./length-matching/types"
import { createLengthMatchingVisualization } from "./length-matching/visualization"
import type { DifferentialPair, HighDensityRoute } from "./types"

/** Coordinates the length-matching state machine; algorithm details live in `length-matching/`. */
export class LengthMatchingSolver extends BaseSolver {
  matchedHdRoutes: HighDensityRoute[]
  private readonly pairs: DifferentialPair[]
  private nextPairIndex = 0
  private activePair: ActivePair | null = null
  private currentAttempt: RegressionAttempt | null = null
  private config: LengthMatchingConfig | null = null
  private candidatesTried = 0

  constructor(private readonly params: LengthMatchingSolverParams) {
    super()
    this.MAX_ITERATIONS = 100_000
    this.matchedHdRoutes = params.hdRoutes.map((route) => ({
      ...route,
      route: route.route.map((point) => ({ ...point })),
    }))
    this.pairs = params.differentialPairs ?? []
  }

  override getSolverName(): string {
    return "LengthMatchingSolver"
  }

  private startNextPair(): void {
    const pair = this.pairs[this.nextPairIndex++]
    if (!pair) {
      this.solved = true
      return
    }
    validatePair(pair, this.params.originalConnections)
    const firstIndexes = findConnectionRouteIndexes(
      this.matchedHdRoutes,
      pair.connectionNames[0],
    )
    const secondIndexes = findConnectionRouteIndexes(
      this.matchedHdRoutes,
      pair.connectionNames[1],
    )
    if (firstIndexes.length === 0 && secondIndexes.length === 0) return
    if (firstIndexes.length === 0 || secondIndexes.length === 0)
      throw new Error(
        `LengthMatchingSolver: differential pair ${pair.connectionNames.join("/")} has routed geometry for only one connection`,
      )
    const firstLength = getConnectionLength(this.matchedHdRoutes, firstIndexes)
    const secondLength = getConnectionLength(
      this.matchedHdRoutes,
      secondIndexes,
    )
    const difference = Math.abs(firstLength - secondLength)
    if (difference <= pair.lengthTolerance) return
    const firstIsShorter = firstLength < secondLength
    const shorterConnectionName = pair.connectionNames[firstIsShorter ? 0 : 1]
    const candidates = createMeanderCandidates({
      routes: this.matchedHdRoutes,
      routeIndexes: firstIsShorter ? firstIndexes : secondIndexes,
      maximumDepth: this.getConfig().maximumMeanderDepth,
      minimumToothPitch: this.getConfig().minimumToothPitch,
      minMeanderGap: this.getConfig().minMeanderGap,
      minMeanderHeight: this.getConfig().minMeanderHeight,
      maxToothCount: this.getConfig().maxToothCount,
    })
    if (candidates.length === 0)
      throw new Error(
        `LengthMatchingSolver: no same-layer straight segment can tune connection "${shorterConnectionName}"`,
      )
    this.activePair = {
      pair,
      shorterConnectionName,
      targetAddedLength: difference,
      remainingAddedLength: difference,
      candidates,
      candidateIndex: 0,
      lastMatchedSegmentIndexByRoute: new Map(),
      partialAttempts: [],
      fullAttempts: [],
      plannedAttemptTargets: null,
    }
  }

  private acceptAttempt(
    activePair: ActivePair,
    attempt: RegressionAttempt,
  ): void {
    const route = this.matchedHdRoutes[attempt.routeIndex]!
    this.matchedHdRoutes[attempt.routeIndex] = {
      ...route,
      route: attempt.predictedRoute,
    }
    activePair.remainingAddedLength -= attempt.addedLength
    activePair.lastMatchedSegmentIndexByRoute.set(
      attempt.routeIndex,
      attempt.span.startIndex,
    )
    activePair.candidateIndex = 0
    activePair.partialAttempts = []
    activePair.fullAttempts = []
    activePair.plannedAttemptTargets?.delete(getRegressionAttemptKey(attempt))
    if (activePair.plannedAttemptTargets?.size === 0)
      activePair.plannedAttemptTargets = null
    if (activePair.remainingAddedLength <= activePair.pair.lengthTolerance)
      this.activePair = null
  }

  private tryCandidate(activePair: ActivePair): void {
    let candidate: ActivePair["candidates"][number] | undefined
    while (!candidate) {
      const nextCandidate = activePair.candidates[activePair.candidateIndex++]
      if (!nextCandidate) break
      const lastMatchedSegmentIndex =
        activePair.lastMatchedSegmentIndexByRoute.get(nextCandidate.routeIndex)
      if (
        (lastMatchedSegmentIndex === undefined ||
          nextCandidate.span.startIndex < lastMatchedSegmentIndex) &&
        (!activePair.plannedAttemptTargets ||
          (activePair.plannedAttemptTargets.has(
            getRegressionAttemptKey(nextCandidate),
          ) &&
            ![...activePair.plannedAttemptTargets.values()].some((attempt) => {
              return (
                attempt.routeIndex === nextCandidate.routeIndex &&
                attempt.span.startIndex > nextCandidate.span.startIndex
              )
            })))
      )
        candidate = nextCandidate
    }
    if (!candidate) {
      const bestFullAttempt =
        activePair.fullAttempts.reduce<RegressionAttempt | null>(
          (bestAttempt, attempt) =>
            !bestAttempt || attempt.qualityScore > bestAttempt.qualityScore
              ? attempt
              : bestAttempt,
          null,
        )
      const partialPlan = selectPartialMeanderPlan({
        attempts: activePair.partialAttempts,
        targetAddedLength: activePair.remainingAddedLength,
        lengthTolerance: activePair.pair.lengthTolerance,
      })
      if (
        bestFullAttempt &&
        (!partialPlan ||
          bestFullAttempt.qualityScore >=
            getMeanderPlanQualityScore(partialPlan.attempts))
      ) {
        this.acceptAttempt(activePair, bestFullAttempt)
        return
      }
      if (!partialPlan)
        throw new Error(
          `LengthMatchingSolver: linear regression exhausted all segment/tooth combinations for "${activePair.shorterConnectionName}"; required ${activePair.targetAddedLength.toFixed(4)}mm`,
        )
      activePair.plannedAttemptTargets = getPlannedAttemptTargets({
        attempts: partialPlan.attempts,
        targetAddedLength: activePair.remainingAddedLength,
      })
      activePair.candidateIndex = 0
      activePair.partialAttempts = []
      activePair.fullAttempts = []
      return
    }
    const route = this.matchedHdRoutes[candidate.routeIndex]!
    const config = this.getConfig()
    const plannedTargetAddedLength = activePair.plannedAttemptTargets?.get(
      getRegressionAttemptKey(candidate),
    )
    if (
      activePair.plannedAttemptTargets !== null &&
      plannedTargetAddedLength === undefined
    )
      throw new Error(
        `LengthMatchingSolver: missing planned target for ${getRegressionAttemptKey(candidate)}`,
      )
    this.currentAttempt = evaluateMeanderCandidate({
      candidate,
      route,
      connectionName: activePair.shorterConnectionName,
      targetAddedLength:
        plannedTargetAddedLength === undefined
          ? activePair.remainingAddedLength
          : plannedTargetAddedLength.targetAddedLength,
      lengthTolerance: activePair.pair.lengthTolerance,
      isGeometryValid: (meanderPoints) =>
        isCandidateGeometryValid({
          route,
          span: candidate.span,
          meanderPoints,
          routedRoutes: this.matchedHdRoutes,
          obstacles: config.obstacles,
          bounds: config.bounds,
          layerCount: config.layerCount,
          obstacleMargin: config.obstacleMargin,
        }),
    })
    this.candidatesTried++
    this.stats = {
      pair: `${activePair.pair.connectionNames[0]}/${activePair.pair.connectionNames[1]}`,
      candidatesTried: this.candidatesTried,
      spanStartIndex: candidate.span.startIndex,
      spanEndIndex: candidate.span.endIndex,
      toothCount: candidate.toothCount,
      toothPitch: candidate.toothPitch,
      placement: candidate.placement,
      predictedScaleFactor: this.currentAttempt.predictedScaleFactor,
      predictedToothDepths: this.currentAttempt.predictedToothDepths,
      resultingError: this.currentAttempt.resultingError,
      qualityScore: this.currentAttempt.qualityScore,
      accepted: this.currentAttempt.valid,
    }
    if (!this.currentAttempt.valid) return
    if (activePair.plannedAttemptTargets !== null) {
      this.acceptAttempt(activePair, this.currentAttempt)
      return
    }
    if (
      activePair.remainingAddedLength - this.currentAttempt.addedLength <=
      activePair.pair.lengthTolerance
    ) {
      activePair.fullAttempts.push(this.currentAttempt)
      return
    }
    activePair.partialAttempts.push(this.currentAttempt)
  }

  private getConfig(): LengthMatchingConfig {
    if (!this.config) this.config = validateAndResolveParams(this.params)
    return this.config
  }

  override _step(): void {
    this.getConfig()
    if (!this.activePair) {
      this.startNextPair()
      return
    }
    this.tryCandidate(this.activePair)
  }

  override getConstructorParams(): [LengthMatchingSolverParams] {
    return [this.params]
  }

  getOutput(): LengthMatchingSolverOutput {
    if (!this.solved)
      throw new Error(
        "LengthMatchingSolver: getOutput() called before the solver completed",
      )
    return { matchedHdRoutes: this.matchedHdRoutes }
  }

  computeProgress(): number {
    if (this.solved) return 1
    if (this.pairs.length === 0) return this.config ? 1 : 0
    const completedPairFraction = Math.max(0, this.nextPairIndex - 1)
    const activePairFraction = this.activePair
      ? this.activePair.candidateIndex / this.activePair.candidates.length
      : 0
    return Math.min(
      0.99,
      (completedPairFraction + activePairFraction) / this.pairs.length,
    )
  }

  override visualize(): GraphicsObject {
    const config = this.getConfig()
    return createLengthMatchingVisualization({
      routes: this.matchedHdRoutes,
      obstacles: config.obstacles,
      bounds: config.bounds,
      layerCount: config.layerCount,
      colorMap: config.colorMap,
      activePair: this.activePair,
      currentAttempt: this.currentAttempt,
      solved: this.solved,
    })
  }
}

export type {
  LengthMatchingSolverOutput,
  LengthMatchingSolverParams,
} from "./length-matching/types"
