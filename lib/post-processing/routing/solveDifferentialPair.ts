import type { DifferentialPair, SimplifiedPcbTrace } from "../../types"
import { createSearchGeometryValidator } from "../geometry/createSearchGeometryValidator"
import { validateCandidateGeometry, type CandidateGeometryContext } from "../geometry/validateCandidateGeometry"
import { matchDifferentialPairLengths } from "../length-matching/matchDifferentialPairLengths"
import { getSimplifiedTraceLength } from "../length-matching/getSimplifiedTraceLength"
import type { PairCandidate, PairSolveResult, ParsedTrace } from "../model/internal-types"
import { parseSimplifiedPcbTrace } from "../model/parseSimplifiedPcbTrace"
import { createCoupledPairCandidate } from "./createCoupledPairCandidate"
import { findCoupledPath } from "./findCoupledPath"

const EDGE_GAP_SAMPLES = [0.75, 0.5, 1, 0.25, 1.25]

/** Route and finally length-match one declared pair as an atomic bundle. */
export const solveDifferentialPair = (input: {
  pair: DifferentialPair
  traces: SimplifiedPcbTrace[]
  obstacles: CandidateGeometryContext["obstacles"]
  bounds: CandidateGeometryContext["bounds"]
  layerCount: number
}): PairSolveResult => {
  const pairName = input.pair.connectionNames.join("/")
  const retained = (message: string): PairSolveResult => ({
    status: "retained",
    error: new Error(`PostProcessingSolver: differential pair ${pairName} ${message}`),
  })
  const firstMatches = input.traces
    .map((trace, index) => ({ trace, index }))
    .filter(({ trace }) => trace.connection_name === input.pair.connectionNames[0])
  const secondMatches = input.traces
    .map((trace, index) => ({ trace, index }))
    .filter(({ trace }) => trace.connection_name === input.pair.connectionNames[1])
  if (firstMatches.length !== 1 || secondMatches.length !== 1)
    return retained("must resolve each connection_name to exactly one non-branching trace")
  if (firstMatches[0]!.index === secondMatches[0]!.index)
    throw new Error(`PostProcessingSolver: pair ${pairName} resolved both members to one trace`)

  let firstParsed: ParsedTrace
  let secondParsed: ParsedTrace
  try {
    firstParsed = parseSimplifiedPcbTrace(firstMatches[0]!.trace, input.layerCount)
    secondParsed = parseSimplifiedPcbTrace(secondMatches[0]!.trace, input.layerCount)
  } catch (error) {
    return retained(
      `has unsupported or invalid routed geometry: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const firstStart = firstParsed.points[0]!
  const firstEnd = firstParsed.points.at(-1)!
  const normalSecondCost =
    Math.hypot(firstStart.x - secondParsed.points[0]!.x, firstStart.y - secondParsed.points[0]!.y) +
    Math.hypot(firstEnd.x - secondParsed.points.at(-1)!.x, firstEnd.y - secondParsed.points.at(-1)!.y)
  const reversedSecondCost =
    Math.hypot(firstStart.x - secondParsed.points.at(-1)!.x, firstStart.y - secondParsed.points.at(-1)!.y) +
    Math.hypot(firstEnd.x - secondParsed.points[0]!.x, firstEnd.y - secondParsed.points[0]!.y)
  const reverseSecond = reversedSecondCost + 1e-8 < normalSecondCost
  const secondStart = reverseSecond ? secondParsed.points.at(-1)! : secondParsed.points[0]!
  const secondEnd = reverseSecond ? secondParsed.points[0]! : secondParsed.points.at(-1)!
  if (firstStart.layer !== secondStart.layer || firstEnd.layer !== secondEnd.layer)
    return retained("does not have common paired layers at both terminal stations")

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
  if (spineLength < 1e-6) return retained("has coincident terminal-pair midpoints")
  const normal = { x: -(end.y - start.y) / spineLength, y: (end.x - start.x) / spineLength }
  const terminalDelta = { x: firstStart.x - secondStart.x, y: firstStart.y - secondStart.y }
  const preferredSide: 1 | -1 = terminalDelta.x * normal.x + terminalDelta.y * normal.y >= 0 ? 1 : -1
  const immutableTraces = input.traces.filter(
    (_, index) => index !== firstMatches[0]!.index && index !== secondMatches[0]!.index,
  )
  const context: CandidateGeometryContext = {
    immutableTraces,
    obstacles: input.obstacles,
    bounds: input.bounds,
    layerCount: input.layerCount,
  }
  const candidates: PairCandidate[] = []

  for (const edgeGap of EDGE_GAP_SAMPLES) {
    const centerlineSpacing = edgeGap + firstParsed.width / 2 + secondParsed.width / 2
    for (const side of [preferredSide, preferredSide === 1 ? -1 : 1] as const) {
      const searchValidator = createSearchGeometryValidator({
        ...context,
        start,
        end,
        firstConnectionName: firstParsed.source.connection_name,
        secondConnectionName: secondParsed.source.connection_name,
        firstStartTerminal: firstStart,
        firstEndTerminal: firstEnd,
        secondStartTerminal: secondStart,
        secondEndTerminal: secondEnd,
        firstWidth: firstParsed.width,
        secondWidth: secondParsed.width,
        firstViaDiameter: firstParsed.transitions[0]?.via_diameter ?? firstParsed.width,
        secondViaDiameter: secondParsed.transitions[0]?.via_diameter ?? secondParsed.width,
        centerlineSpacing,
        side,
      })
      const path = findCoupledPath({
        start,
        end,
        bounds: input.bounds,
        layerCount: input.layerCount,
        gridStep: Math.max(0.25, Math.min(0.5, centerlineSpacing / 2)),
        ...searchValidator,
      })
      if (!path) continue
      const candidate = createCoupledPairCandidate({
        first: firstParsed,
        second: secondParsed,
        reverseSecond,
        path,
        centerlineSpacing,
        edgeGap,
        side,
        layerCount: input.layerCount,
      })
      if (!validateCandidateGeometry(candidate.firstParsed, candidate.secondParsed, context))
        continue
      const matched = matchDifferentialPairLengths({ candidate, pair: input.pair, context })
      if (matched) candidates.push(matched)
    }
  }
  if (candidates.length === 0)
    return retained(
      `could not be improved without violating bounds, copper clearance, coupled vias, or length tolerance ${input.pair.lengthTolerance}`,
    )
  const score = (candidate: PairCandidate): number => {
    const spacingPenalty = candidate.edgeGap < 0.5
      ? (0.5 - candidate.edgeGap) * 100
      : candidate.edgeGap > 1
        ? (candidate.edgeGap - 1) * 100
        : 0
    return spacingPenalty +
      getSimplifiedTraceLength(candidate.firstParsed) +
      getSimplifiedTraceLength(candidate.secondParsed) +
      candidate.bendCount * 0.15 + candidate.viaPairCount * 8
  }
  candidates.sort((left, right) =>
    score(left) - score(right) || left.edgeGap - right.edgeGap,
  )
  return { status: "accepted", candidate: candidates[0]! }
}
