import type { DifferentialPair, SimplifiedPcbTrace } from "../../types"
import type { PostProcessingGridConfig } from "../types"
import { createSearchGeometryValidator } from "../geometry/createSearchGeometryValidator"
import {
  validateCandidateGeometry,
  type CandidateGeometryContext,
} from "../geometry/validateCandidateGeometry"
import { getSimplifiedTraceLength } from "../length-matching/getSimplifiedTraceLength"
import type {
  PairCandidate,
  PairSolveResult,
  ParsedTrace,
} from "../model/internal-types"
import { parseSimplifiedPcbTrace } from "../model/parseSimplifiedPcbTrace"
import { createCoupledPairCandidate } from "./createCoupledPairCandidate"
import { IncrementalCoupledPathSearch } from "./IncrementalCoupledPathSearch"
import { resolvePostProcessingGridConfig } from "./resolvePostProcessingGridConfig"
import type { CoupledPathPoint, CoupledPathSearchInput } from "./types"

const EDGE_GAP_SAMPLES = [0.75, 0.5, 1, 0.25, 1.25]

type PreparedPair = {
  first: ParsedTrace
  second: ParsedTrace
  reverseSecond: boolean
  terminalFanout: boolean
  context: CandidateGeometryContext
  attempts: Array<{
    edgeGap: number
    side: 1 | -1
    input: CoupledPathSearchInput
  }>
}

export type DifferentialPairRoutingInput = {
  pair: DifferentialPair
  traces: SimplifiedPcbTrace[]
  obstacles: CandidateGeometryContext["obstacles"]
  bounds: CandidateGeometryContext["bounds"]
  layerCount: number
  routingGrid?: PostProcessingGridConfig
}

/** Incrementally explores and scores coupled route candidates for one differential pair. */
export class DifferentialPairRoutingSession {
  private readonly pairName: string
  private readonly prepared: PreparedPair | null
  private readonly candidates: PairCandidate[] = []
  private result: PairSolveResult | null = null
  private search: IncrementalCoupledPathSearch | null = null
  private nextAttempt = 0
  private exploredNodeCount = 0
  private allocatedSearchStateCount = 0

  constructor(private readonly input: DifferentialPairRoutingInput) {
    this.pairName = input.pair.connectionNames.join("/")
    this.prepared = this.prepare()
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
    const attemptCount = this.prepared?.attempts.length ?? 1
    const attemptProgress = this.search?.getProgress() ?? 0
    return Math.min(0.99, (this.nextAttempt + attemptProgress) / attemptCount)
  }

  getAllocatedSearchStateCount(): number {
    return this.allocatedSearchStateCount
  }

  getStats(): Record<string, number | string> {
    return {
      phase: this.search ? "searching" : "candidate-selection",
      pair: this.pairName,
      attemptIndex: this.nextAttempt,
      attemptCount: this.prepared?.attempts.length ?? 0,
      exploredNodeCount:
        this.exploredNodeCount + (this.search?.getExploredCount() ?? 0),
      gridNodeCount: this.search?.getGridNodeCount() ?? 0,
      acceptedCandidateCount: this.candidates.length,
    }
  }

  step(): void {
    if (this.result) return
    const prepared = this.prepared
    if (!prepared)
      throw new Error(
        `PostProcessingSolver: differential pair ${this.pairName} has no prepared state`,
      )
    if (!this.search) {
      const attempt = prepared.attempts[this.nextAttempt]
      if (!attempt) {
        this.complete()
        return
      }
      this.search = new IncrementalCoupledPathSearch(attempt.input)
      this.allocatedSearchStateCount += this.search.getSearchStateLimit()
      return
    }
    this.search.step()
    if (!this.search.isComplete()) return
    const path = this.search.getPath()
    this.exploredNodeCount += this.search.getExploredCount()
    const attempt = prepared.attempts[this.nextAttempt]
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
      terminalFanout: prepared.terminalFanout,
    })
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

  private prepare(): PreparedPair | null {
    const retained = (message: string): null => {
      this.result = {
        status: "retained",
        error: new Error(
          `PostProcessingSolver: differential pair ${this.pairName} ${message}`,
        ),
      }
      return null
    }
    const firstMatches = this.input.traces
      .map((trace, index) => ({ trace, index }))
      .filter(
        ({ trace }) =>
          trace.connection_name === this.input.pair.connectionNames[0],
      )
    const secondMatches = this.input.traces
      .map((trace, index) => ({ trace, index }))
      .filter(
        ({ trace }) =>
          trace.connection_name === this.input.pair.connectionNames[1],
      )
    if (firstMatches.length !== 1 || secondMatches.length !== 1)
      throw new Error(
        `PostProcessingSolver: differential pair ${this.pairName} must resolve each connection_name to exactly one non-branching trace`,
      )
    if (firstMatches[0]!.index === secondMatches[0]!.index)
      throw new Error(
        `PostProcessingSolver: pair ${this.pairName} resolved both members to one trace`,
      )

    let first: ParsedTrace
    let second: ParsedTrace
    try {
      first = parseSimplifiedPcbTrace(
        firstMatches[0]!.trace,
        this.input.layerCount,
      )
      second = parseSimplifiedPcbTrace(
        secondMatches[0]!.trace,
        this.input.layerCount,
      )
    } catch (error) {
      throw new Error(
        `PostProcessingSolver: differential pair ${this.pairName} has unsupported or invalid routed geometry: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    const firstStart = first.points[0]!
    const firstEnd = first.points.at(-1)!
    const normalSecondCost =
      Math.hypot(
        firstStart.x - second.points[0]!.x,
        firstStart.y - second.points[0]!.y,
      ) +
      Math.hypot(
        firstEnd.x - second.points.at(-1)!.x,
        firstEnd.y - second.points.at(-1)!.y,
      )
    const reversedSecondCost =
      Math.hypot(
        firstStart.x - second.points.at(-1)!.x,
        firstStart.y - second.points.at(-1)!.y,
      ) +
      Math.hypot(
        firstEnd.x - second.points[0]!.x,
        firstEnd.y - second.points[0]!.y,
      )
    const reverseSecond = reversedSecondCost + 1e-8 < normalSecondCost
    const secondStart = reverseSecond
      ? second.points.at(-1)!
      : second.points[0]!
    const secondEnd = reverseSecond ? second.points[0]! : second.points.at(-1)!
    if (
      firstStart.layer !== secondStart.layer ||
      firstEnd.layer !== secondEnd.layer
    )
      return retained(
        "does not have common paired layers at both terminal stations",
      )

    const start = {
      x: (firstStart.x + secondStart.x) / 2,
      y: (firstStart.y + secondStart.y) / 2,
      layer: firstStart.layer,
    }
    const end = {
      x: (firstEnd.x + secondEnd.x) / 2,
      y: (firstEnd.y + secondEnd.y) / 2,
      layer: firstEnd.layer,
    }
    const spineLength = Math.hypot(end.x - start.x, end.y - start.y)
    if (spineLength < 1e-6)
      return retained("has coincident terminal-pair midpoints")
    const normal = {
      x: -(end.y - start.y) / spineLength,
      y: (end.x - start.x) / spineLength,
    }
    const terminalDelta = {
      x: firstStart.x - secondStart.x,
      y: firstStart.y - secondStart.y,
    }
    const preferredSide: 1 | -1 =
      terminalDelta.x * normal.x + terminalDelta.y * normal.y >= 0 ? 1 : -1
    const hasInlineTerminalPair = (
      firstPoint: typeof firstStart,
      secondPoint: typeof secondStart,
    ): boolean => {
      const deltaX = firstPoint.x - secondPoint.x
      const deltaY = firstPoint.y - secondPoint.y
      const separation = Math.hypot(deltaX, deltaY)
      return (
        separation > 1e-8 &&
        Math.abs(deltaX * normal.x + deltaY * normal.y) / separation < 0.5
      )
    }
    const terminalFanout =
      hasInlineTerminalPair(firstStart, secondStart) &&
      hasInlineTerminalPair(firstEnd, secondEnd)
    const context: CandidateGeometryContext = {
      immutableTraces: this.input.traces.filter(
        (_, index) =>
          index !== firstMatches[0]!.index && index !== secondMatches[0]!.index,
      ),
      obstacles: this.input.obstacles,
      bounds: this.input.bounds,
      layerCount: this.input.layerCount,
    }
    const attempts = EDGE_GAP_SAMPLES.flatMap((edgeGap) => {
      const centerlineSpacing = edgeGap + first.width / 2 + second.width / 2
      return ([preferredSide, preferredSide === 1 ? -1 : 1] as const).map(
        (side) => {
          const validator = createSearchGeometryValidator({
            ...context,
            start,
            end,
            firstConnectionName: first.source.connection_name,
            secondConnectionName: second.source.connection_name,
            firstStartTerminal: firstStart,
            firstEndTerminal: firstEnd,
            secondStartTerminal: secondStart,
            secondEndTerminal: secondEnd,
            firstWidth: first.width,
            secondWidth: second.width,
            firstViaDiameter: first.transitions[0]?.via_diameter ?? first.width,
            secondViaDiameter:
              second.transitions[0]?.via_diameter ?? second.width,
            centerlineSpacing,
            side,
            terminalFanout,
          })
          return {
            edgeGap,
            side,
            input: {
              start,
              end,
              bounds: this.input.bounds,
              layerCount: this.input.layerCount,
              grid: resolvePostProcessingGridConfig({
                config: this.input.routingGrid,
                bounds: this.input.bounds,
                defaultInnerGridStep: Math.max(
                  0.25,
                  Math.min(0.5, centerlineSpacing / 2),
                ),
              }),
              ...validator,
            },
          }
        },
      )
    })
    return { first, second, reverseSecond, terminalFanout, context, attempts }
  }

  private complete(): void {
    if (this.candidates.length === 0) {
      this.result = {
        status: "retained",
        error: new Error(
          `PostProcessingSolver: differential pair ${this.pairName} could not be improved without violating bounds, copper clearance, or coupled-via constraints`,
        ),
      }
      return
    }
    this.candidates.sort(
      (left, right) =>
        this.score(left) - this.score(right) || left.edgeGap - right.edgeGap,
    )
    this.result = { status: "accepted", candidate: this.candidates[0]! }
  }

  private score(candidate: PairCandidate): number {
    const spacingPenalty =
      candidate.edgeGap < 0.5
        ? (0.5 - candidate.edgeGap) * 100
        : candidate.edgeGap > 1
          ? (candidate.edgeGap - 1) * 100
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
