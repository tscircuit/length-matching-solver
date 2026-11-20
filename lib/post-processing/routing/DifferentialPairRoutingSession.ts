import { DifferentialPairRoutingError } from "../errors/DifferentialPairRoutingError"
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
import { getCenterlineDistanceSamples } from "./getCenterlineDistanceSamples"
import { MAXIMUM_ROW_FANOUT_ITERATIONS_PER_PAIR } from "./getDifferentialPairReroutingIterationLimit"
import { getForwardPairSearchStart } from "./getForwardPairSearchStart"
import { getTerminalRowEscapeDirectionPairs } from "./getTerminalRowEscapeDirectionPairs"
import { createTerminalEscapeValidator } from "./createTerminalEscapeValidator"
import { IncrementalCoupledPathSearch } from "./IncrementalCoupledPathSearch"
import { isInlineTerminalPair } from "./isInlineTerminalPair"
import { resolvePostProcessingGridConfig } from "./resolvePostProcessingGridConfig"
import { resolvePairFanoutStations } from "./resolvePairFanoutStations"
import type {
  CoupledPathPoint,
  DifferentialPairRoutingInput,
  PreparedPair,
} from "./types"
export type { DifferentialPairRoutingInput } from "./types"

const EDGE_GAP_SAMPLES = [0.75, 0.5, 1, 0.25, 1.25]
const CENTERLINE_DISTANCE_PENALTY_PER_MM = 100

/** Incrementally explores and scores coupled route candidates for one differential pair. */
export class DifferentialPairRoutingSession {
  private readonly pairName: string
  private readonly prepared: PreparedPair
  private readonly candidates: PairCandidate[] = []
  private result: PairSolveResult | null = null
  private search: IncrementalCoupledPathSearch | null = null
  private fanoutPending = false
  private rowFanoutIterations: number | null = null
  private nextAttempt = 0
  private exploredNodeCount = 0

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
    let attemptCount = this.prepared.attempts.length
    if (attemptCount === 0) return 0
    if (this.fanoutPending && this.candidates.length === 0) attemptCount *= 2
    const attemptProgress = this.search?.getProgress() ?? 0
    return Math.min(0.99, (this.nextAttempt + attemptProgress) / attemptCount)
  }

  getStats(): Record<string, number | string> {
    return {
      phase: this.search ? "searching" : "candidate-selection",
      pair: this.pairName,
      attemptIndex: this.nextAttempt,
      attemptCount: this.prepared.attempts.length,
      exploredNodeCount:
        this.exploredNodeCount + (this.search?.getExploredCount() ?? 0),
      gridNodeCount: this.search?.getGridNodeCount() ?? 0,
      acceptedCandidateCount: this.candidates.length,
    }
  }

  step(): void {
    if (this.result) return
    if (this.rowFanoutIterations !== null) {
      if (
        this.rowFanoutIterations >= MAXIMUM_ROW_FANOUT_ITERATIONS_PER_PAIR ||
        this.input.reserveRowFanoutIteration?.() === false
      ) {
        this.complete()
        return
      }
      this.rowFanoutIterations++
    }
    const prepared = this.prepared
    if (!this.search) {
      if (
        this.nextAttempt === prepared.attempts.length &&
        this.candidates.length === 0 &&
        this.fanoutPending
      ) {
        if (
          !this.hasSpacingPreference &&
          validateCandidateGeometry(
            prepared.first,
            prepared.second,
            prepared.context,
          )
        ) {
          this.result = { status: "retained" }
          return
        }
        prepared.attempts.push(...this.prepare("fanout").attempts)
      }
      if (
        this.nextAttempt === prepared.attempts.length &&
        this.candidates.length === 0 &&
        prepared.hasMixedTerminalOrientation &&
        this.rowFanoutIterations === null
      ) {
        this.rowFanoutIterations = 0
        prepared.attempts.push(...this.prepare("row-fanout").attempts)
      }
      const attempt = prepared.attempts[this.nextAttempt]
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
    if (this.rowFanoutIterations !== null) this.complete()
  }

  private get hasSpacingPreference(): boolean {
    return (
      this.input.pair.minimumCenterlineDistance !== undefined ||
      this.input.pair.maximumCenterlineDistance !== undefined
    )
  }

  private prepare(
    search: "initial" | "fanout" | "row-fanout" = "initial",
  ): PreparedPair {
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
      throw new DifferentialPairRoutingError({
        connectionNames: this.input.pair.connectionNames,
        reason: "trace-resolution-failure",
        message:
          "must resolve each connection_name to exactly one non-branching trace",
      })
    if (firstMatches[0]!.index === secondMatches[0]!.index)
      throw new DifferentialPairRoutingError({
        connectionNames: this.input.pair.connectionNames,
        reason: "trace-resolution-failure",
        message: "resolved both members to one trace",
      })

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
      throw new DifferentialPairRoutingError({
        connectionNames: this.input.pair.connectionNames,
        reason: "invalid-routed-geometry",
        message: `has unsupported or invalid routed geometry: ${error instanceof Error ? error.message : String(error)}`,
      })
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
      throw new DifferentialPairRoutingError({
        connectionNames: this.input.pair.connectionNames,
        reason: "terminal-layer-mismatch",
        message: "does not have common paired layers at both terminal stations",
      })

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
      throw new DifferentialPairRoutingError({
        connectionNames: this.input.pair.connectionNames,
        reason: "coincident-terminal-midpoints",
        message: "has coincident terminal-pair midpoints",
      })
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
    const inlineStart = isInlineTerminalPair(firstStart, secondStart, normal)
    const inlineEnd = isInlineTerminalPair(firstEnd, secondEnd, normal)
    const terminalFanout = inlineStart && inlineEnd
    const hasMixedTerminalOrientation = inlineStart !== inlineEnd
    const spineDirection = { x: normal.y, y: -normal.x }
    const context: CandidateGeometryContext = {
      immutableTraces: this.input.traces.filter(
        (_, index) =>
          index !== firstMatches[0]!.index && index !== secondMatches[0]!.index,
      ),
      obstacles: this.input.obstacles,
      bounds: this.input.bounds,
      layerCount: this.input.layerCount,
      minTraceToPadEdgeClearance: this.input.minTraceToPadEdgeClearance,
    }
    const useRowFanout = search === "row-fanout"
    const centerlineDistanceSamples = getCenterlineDistanceSamples({
      minimumCenterlineDistance: this.input.pair.minimumCenterlineDistance,
      maximumCenterlineDistance: this.input.pair.maximumCenterlineDistance,
      minimumPhysicalDistance: first.width / 2 + second.width / 2,
      restrictToPreference: useRowFanout,
      legacyCenterlineDistances: EDGE_GAP_SAMPLES.map(
        (edgeGap) => edgeGap + first.width / 2 + second.width / 2,
      ),
    })
    const { maxUncoupledLength } = this.input.pair
    const modes: ("forward" | "fanout")[] = []
    if (search !== "initial" || maxUncoupledLength !== undefined) {
      modes.push("fanout")
    } else {
      modes.push("forward")
      if (
        hasMixedTerminalOrientation &&
        (this.hasSpacingPreference ||
          !validateCandidateGeometry(first, second, context))
      ) {
        modes.push("fanout")
      }
    }
    this.fanoutPending = !terminalFanout && !modes.includes("fanout")
    const directions = useRowFanout
      ? getTerminalRowEscapeDirectionPairs(
          [firstStart, secondStart],
          [firstEnd, secondEnd],
        )
      : [{ startDirection: spineDirection, endDirection: spineDirection }]
    const sides = [preferredSide, preferredSide === 1 ? -1 : 1] as const
    const attempts = centerlineDistanceSamples.flatMap((centerlineSpacing) => {
      const edgeGap = centerlineSpacing - first.width / 2 - second.width / 2
      const grid = resolvePostProcessingGridConfig({
        config: this.input.routingGrid,
        bounds: this.input.bounds,
        defaultInnerGridStep: Math.max(
          0.25,
          Math.min(0.5, centerlineSpacing / 2),
        ),
      })
      const spacingAttempts = sides.flatMap((side) =>
        modes.flatMap((mode) =>
          directions.flatMap((directionPair) => {
            const { startDirection, endDirection } = directionPair
            const createValidator = (
              searchStart: CoupledPathPoint,
              searchEnd: CoupledPathPoint,
            ) =>
              createSearchGeometryValidator({
                ...context,
                start: searchStart,
                end: searchEnd,
                firstConnectionName: first.source.connection_name,
                secondConnectionName: second.source.connection_name,
                firstStartTerminal: firstStart,
                firstEndTerminal: firstEnd,
                secondStartTerminal: secondStart,
                secondEndTerminal: secondEnd,
                firstWidth: first.width,
                secondWidth: second.width,
                firstViaDiameter:
                  first.transitions[0]?.via_diameter ?? first.viaDiameter,
                secondViaDiameter:
                  second.transitions[0]?.via_diameter ?? second.viaDiameter,
                centerlineSpacing,
                side,
                terminalFanout,
                terminalMiterMargin:
                  mode === "fanout"
                    ? useRowFanout
                      ? 0
                      : centerlineSpacing / 2
                    : undefined,
              })
            let searchStart = start
            let searchEnd = end
            if (!terminalFanout && mode === "forward") {
              searchStart = getForwardPairSearchStart({
                start,
                terminals: [firstStart, secondStart],
                spineDirection,
                spineNormal: normal,
                centerlineSpacing,
                side,
              })
            }
            if (!terminalFanout && mode === "fanout") {
              const stations = resolvePairFanoutStations({
                start: {
                  anchor: start,
                  direction: startDirection,
                  terminals: [firstStart, secondStart],
                },
                end: {
                  anchor: end,
                  direction: endDirection,
                  terminals: [firstEnd, secondEnd],
                },
                spineDirection,
                centerlineSpacing,
                side,
                maxUncoupledLength,
                availableTravelDistance: spineLength,
                searchStep: grid.innerGridStep,
                isTerminalFanoutValid: createValidator(start, end)
                  .isTerminalFanoutValid,
              })
              if (!stations) return []
              searchStart = stations.start
              searchEnd = stations.end
            }
            const validator = createValidator(searchStart, searchEnd)
            return [
              {
                edgeGap,
                side,
                input: {
                  start: searchStart,
                  end: searchEnd,
                  bounds: this.input.bounds,
                  layerCount: this.input.layerCount,
                  grid,
                  ...(useRowFanout
                    ? createTerminalEscapeValidator(
                        validator,
                        [searchStart, searchEnd],
                        directionPair,
                      )
                    : validator),
                },
              },
            ]
          }),
        ),
      )
      if (useRowFanout)
        spacingAttempts.sort(
          ({ input: a }, { input: b }) =>
            Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y) -
            Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y),
        )
      return spacingAttempts
    })
    return {
      first,
      second,
      reverseSecond,
      terminalFanout,
      hasMixedTerminalOrientation,
      context,
      attempts,
    }
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
    const { edgeGap, centerlineDistance } = candidate
    let spacingDeviation = Math.max(0, 0.5 - edgeGap, edgeGap - 1)
    if (this.hasSpacingPreference) {
      const {
        minimumCenterlineDistance: min = centerlineDistance,
        maximumCenterlineDistance: max = centerlineDistance,
      } = this.input.pair
      spacingDeviation =
        Math.max(0, min - centerlineDistance) +
        Math.max(0, centerlineDistance - max)
    }
    return (
      spacingDeviation * CENTERLINE_DISTANCE_PENALTY_PER_MM +
      getSimplifiedTraceLength(candidate.firstParsed) +
      getSimplifiedTraceLength(candidate.secondParsed) +
      candidate.bendCount * 0.15 +
      candidate.viaPairCount * 8
    )
  }
}
