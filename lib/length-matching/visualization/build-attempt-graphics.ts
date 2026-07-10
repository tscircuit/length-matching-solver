import type { HighDensityRoute } from "../../types"
import type { ActivePair, RegressionAttempt } from "../internal-types"
import type { LengthMatchingColorTheme } from "./color-theme"
import { getGraphicsLayerForRoute } from "./graphics-layers"
import type { LengthMatchingGraphics } from "./types"

/** Append the latest candidate diagnostic without mutating solver state. */
export const buildAttemptGraphics = (input: {
  routes: HighDensityRoute[]
  attempt: RegressionAttempt | null
  activePair: ActivePair | null
  showAttempt: boolean
  theme: LengthMatchingColorTheme
  graphics: LengthMatchingGraphics
}): void => {
  if (!input.showAttempt) return
  if (!input.attempt) {
    appendSelectedSegmentGraphics(input)
    return
  }
  const route = input.routes[input.attempt.routeIndex]!
  const [start, end] = input.attempt.testedSegment
  const connectionColor = input.theme.getConnectionColor(
    input.attempt.connectionName,
  )
  input.graphics.lines.push({
    points: [start, end],
    strokeColor: input.theme.getTestedSegmentColor(connectionColor),
    strokeWidth: route.traceThickness,
    strokeDash: [0.15, 0.15],
    layer: getGraphicsLayerForRoute(start.z),
  })
  if (!input.attempt.valid)
    input.graphics.lines.push({
      points: input.attempt.meanderPoints.map(({ x, y }) => ({ x, y })),
      strokeColor: input.theme.getRejectedCandidateColor(connectionColor),
      strokeWidth: route.traceThickness,
      strokeDash: [0.1, 0.1],
      layer: getGraphicsLayerForRoute(start.z),
    })
  else
    input.graphics.lines.push({
      points: input.attempt.meanderPoints.map(({ x, y }) => ({ x, y })),
      strokeColor: "rgba(234, 179, 8, 0.6)",
      strokeWidth: route.traceThickness * 2,
      strokeDash: [0.1, 0.1],
      layer: getGraphicsLayerForRoute(start.z),
    })
  input.graphics.points.push(
    {
      x: start.x,
      y: start.y,
      color: connectionColor,
      layer: getGraphicsLayerForRoute(start.z),
    },
    {
      x: end.x,
      y: end.y,
      color: connectionColor,
      layer: getGraphicsLayerForRoute(end.z),
    },
  )
}

const appendSelectedSegmentGraphics = (input: {
  routes: HighDensityRoute[]
  activePair: ActivePair | null
  theme: LengthMatchingColorTheme
  graphics: LengthMatchingGraphics
}): void => {
  const candidate = input.activePair?.candidates[input.activePair.candidateIndex]
  if (!candidate) return
  const route = input.routes[candidate.routeIndex]
  if (!route) return
  const start = route.route[candidate.segmentIndex]
  const end = route.route[candidate.segmentIndex + 1]
  if (!start || !end) return
  input.graphics.lines.push({
    points: [start, end],
    strokeColor: "rgba(234, 179, 8, 0.6)",
    strokeWidth: route.traceThickness * 2,
    strokeDash: [0.1, 0.1],
    layer: getGraphicsLayerForRoute(start.z),
  })
}
