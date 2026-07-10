import type { Circle, Line, Point, Rect } from "graphics-debug"
import type { HighDensityRoute, Obstacle } from "../../types"
import type { ActivePair, RegressionAttempt } from "../internal-types"

/** Explicit state needed to render one length-matching debug view. */
export type LengthMatchingVisualizationInput = {
  routes: HighDensityRoute[]
  obstacles: Obstacle[]
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  colorMap: Record<string, string>
  activePair: ActivePair | null
  currentAttempt: RegressionAttempt | null
  solved: boolean
}

export type LengthMatchingGraphics = {
  lines: Line[]
  points: Point[]
  rects: Rect[]
  circles: Circle[]
}
