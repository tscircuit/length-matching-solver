import type { DifferentialPair, SimplifiedPcbTrace } from "../../types"
import { DifferentialPairRoutingError } from "../errors/DifferentialPairRoutingError"
import type { PostProcessingGridConfig } from "../types"
import {
  validateCandidateGeometry,
  type CandidateGeometryContext,
} from "../geometry/validateCandidateGeometry"
import { getSimplifiedTraceLength } from "../length-matching/getSimplifiedTraceLength"
import type { PairCandidate, PairSolveResult } from "../model/internal-types"
import { createCoupledPairCandidate } from "./createCoupledPairCandidate"
import { hasPairSpacingPreference } from "./hasPairSpacingPreference"
import { IncrementalCoupledPathSearch } from "./IncrementalCoupledPathSearch"
import {
  prepareTerminalSearchAttempts,
  type TerminalSearchAttempt,
  type TerminalSearchMode,
} from "./prepareTerminalSearchAttempts"
import {
  getPairRoutingGeometry,
  type PairRoutingGeometry,
} from "./getPairRoutingGeometry"
import type { CoupledPathPoint } from "./types"

const CENTERLINE_DISTANCE_PENALTY_PER_MM = 100

export type DifferentialPairRoutingInput = {
  pair: DifferentialPair
  traces: SimplifiedPcbTrace[]
  obstacles: CandidateGeometryContext["obstacles"]
  bounds: CandidateGeometryContext["bounds"]
  layerCount: number
  minTraceToPadEdgeClearance?: number
  routingGrid?: PostProcessingGridConfig
}

/** Incrementally explores and scores coupled route candidates for one differential pair. */
export class DifferentialPairRoutingSession {
  private readonly pairName: string
  private readonly prepared: PairRoutingGeometry
  private readonly attempts: TerminalSearchAttempt[]
  private fanoutPending: boolean
  private readonly candidates: PairCandidate[] = []
  private result: PairSolveResult | null = null
  private search: IncrementalCoupledPathSearch | null = null
  private nextAttempt = 0
  private exploredNodeCount = 0

  constructor(private readonly input: DifferentialPairRoutingInput) {
    this.pairName = input.pair.connectionNames.join("/")
    this.prepared = getPairRoutingGeometry(input)
    const { first, second, context, hasMixedTerminalOrientation } =
      this.prepared
    const { pair } = input
    const modes: TerminalSearchMode[] = []
    if (pair.maxUncoupledLength !== undefined) {
      modes.push("fanout")
    } else {
      modes.push("forward")
      if (
        hasMixedTerminalOrientation &&
        (hasPairSpacingPreference(pair) ||
          !validateCandidateGeometry(first, second, context))
      )
        modes.push("fanout")
    }
    this.attempts = prepareTerminalSearchAttempts(modes, this.prepared)
    this.fanoutPending =
      !this.prepared.bothEndsAreInline && !modes.includes("fanout")
  }

  isComplete(): boolean {
    return this.result !== null
  }

  getResult(): PairSolveResult {
    if (!this.result)
      throw new Error(
        `PostProcessingSolver: differential pair ${this.pairName} is not complete`,
      )
    return this.result
  }

  getPreviewPath(): CoupledPathPoint[] | null {
    return this.search?.getPreviewPath() ?? null
  }

  getProgress(): number {
    if (this.result) return 1
    let attemptCount = this.attempts.length
    if (attemptCount === 0) return 0
    if (this.fanoutPending && this.candidates.length === 0) {
      attemptCount *= 2
    }
    const attemptProgress = this.search?.getProgress() ?? 0
    return Math.min(0.99, (this.nextAttempt + attemptProgress) / attemptCount)
  }

  getStats(): Record<string, number | string> {
    return {
      phase: this.search ? "searching" : "candidate-selection",
      pair: this.pairName,
      attemptIndex: this.nextAttempt,
      attemptCount: this.attempts.length,
      exploredNodeCount:
        this.exploredNodeCount + (this.search?.getExploredCount() ?? 0),
      gridNodeCount: this.search?.getGridNodeCount() ?? 0,
      acceptedCandidateCount: this.candidates.length,
    }
  }

  step(): void {
    if (this.result) return
    const prepared = this.prepared
    if (!this.search) {
      if (
        this.nextAttempt === this.attempts.length &&
        this.candidates.length === 0 &&
        this.fanoutPending
      ) {
        if (
          !hasPairSpacingPreference(this.input.pair) &&
          validateCandidateGeometry(
            prepared.first,
            prepared.second,
            prepared.context,
          )
        ) {
          this.result = { status: "retained" }
          return
        }
        this.fanoutPending = false
        this.attempts.push(
          ...prepareTerminalSearchAttempts(["fanout"], prepared),
        )
      }
      const attempt = this.attempts[this.nextAttempt]
      if (!attempt) {
        this.complete()
        return
      }
      this.search = new IncrementalCoupledPathSearch(attempt.input)
      return
    }
    this.search.step()
    if (!this.search.isComplete()) return
    const path = this.search.getPath()
    this.exploredNodeCount += this.search.getExploredCount()
    const attempt = this.attempts[this.nextAttempt]
    if (!attempt)
      throw new Error(
        `PostProcessingSolver: differential pair ${this.pairName} lost its active attempt`,
      )
    this.search = null
    this.nextAttempt++
    if (!path) return
    const candidate = createCoupledPairCandidate({
      first: prepared.first,
      second: prepared.second,
      reverseSecond: prepared.reverseSecond,
      path,
      centerlineSpacing:
        attempt.edgeGap + prepared.first.width / 2 + prepared.second.width / 2,
      edgeGap: attempt.edgeGap,
      side: attempt.side,
      layerCount: this.input.layerCount,
      terminalFanout: prepared.bothEndsAreInline,
    })
    if (!candidate) return
    if (
      !validateCandidateGeometry(
        candidate.firstParsed,
        candidate.secondParsed,
        prepared.context,
      )
    )
      return
    this.candidates.push(candidate)
  }

  private complete(): void {
    if (this.candidates.length === 0)
      throw new DifferentialPairRoutingError({
        connectionNames: this.input.pair.connectionNames,
        reason: "no-valid-candidate",
        message:
          "could not be improved without violating bounds, copper clearance, or coupled-via constraints",
      })
    this.candidates.sort(
      (left, right) =>
        this.score(left) - this.score(right) || left.edgeGap - right.edgeGap,
    )
    this.result = { status: "accepted", candidate: this.candidates[0]! }
  }

  private score(candidate: PairCandidate): number {
    const spacingPenalty = hasPairSpacingPreference(this.input.pair)
      ? Math.max(
          0,
          (this.input.pair.minimumCenterlineDistance ??
            Number.NEGATIVE_INFINITY) - candidate.centerlineDistance,
        ) *
          CENTERLINE_DISTANCE_PENALTY_PER_MM +
        Math.max(
          0,
          candidate.centerlineDistance -
            (this.input.pair.maximumCenterlineDistance ??
              Number.POSITIVE_INFINITY),
        ) *
          CENTERLINE_DISTANCE_PENALTY_PER_MM
      : candidate.edgeGap < 0.5
        ? (0.5 - candidate.edgeGap) * CENTERLINE_DISTANCE_PENALTY_PER_MM
        : candidate.edgeGap > 1
          ? (candidate.edgeGap - 1) * CENTERLINE_DISTANCE_PENALTY_PER_MM
          : 0
    return (
      spacingPenalty +
      getSimplifiedTraceLength(candidate.firstParsed) +
      getSimplifiedTraceLength(candidate.secondParsed) +
      candidate.bendCount * 0.15 +
      candidate.viaPairCount * 8
    )
  }
}
