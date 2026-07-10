import type { HighDensityRoute } from "../../types"
import type { RegressionAttempt } from "../internal-types"
import type { LengthMatchingColorTheme } from "./color-theme"
import { getGraphicsLayerForRoute } from "./graphics-layers"
import type { LengthMatchingGraphics } from "./types"

/** Append the latest candidate diagnostic without mutating solver state. */
export const buildAttemptGraphics = (input: { routes: HighDensityRoute[]; attempt: RegressionAttempt | null; theme: LengthMatchingColorTheme; graphics: LengthMatchingGraphics }): void => {
  if (!input.attempt) return
  const route = input.routes[input.attempt.routeIndex]!
  const [start, end] = input.attempt.testedSegment
  const connectionColor = input.theme.getConnectionColor(input.attempt.connectionName)
  input.graphics.lines.push({ points: [start, end], strokeColor: input.theme.getTestedSegmentColor(connectionColor), strokeWidth: route.traceThickness, strokeDash: [0.15, 0.15], label: `tested segment\n${input.attempt.toothCount} teeth`, layer: getGraphicsLayerForRoute(start.z) })
  if (!input.attempt.valid) input.graphics.lines.push({ points: input.attempt.meanderPoints.map(({ x, y }) => ({ x, y })), strokeColor: input.theme.getRejectedCandidateColor(connectionColor), strokeWidth: route.traceThickness, strokeDash: [0.1, 0.1], label: [`candidate rejected`, `depth ${input.attempt.predictedDepth.toFixed(3)}`, `error ${input.attempt.resultingError.toFixed(5)}`].join("\n"), layer: getGraphicsLayerForRoute(start.z) })
  input.graphics.points.push({ x: start.x, y: start.y, color: connectionColor, label: `${input.attempt.connectionName}\nsegment start`, layer: getGraphicsLayerForRoute(start.z) }, { x: end.x, y: end.y, color: connectionColor, label: `${input.attempt.connectionName}\nsegment end`, layer: getGraphicsLayerForRoute(end.z) })
}
