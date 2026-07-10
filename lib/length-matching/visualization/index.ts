import type { GraphicsObject } from "graphics-debug"
import { buildAttemptGraphics } from "./build-attempt-graphics"
import { buildObstacleGraphics } from "./build-obstacle-graphics"
import { buildRouteGraphics } from "./build-route-graphics"
import { createLengthMatchingColorTheme } from "./color-theme"
import type { LengthMatchingGraphics, LengthMatchingVisualizationInput } from "./types"

/** Compose the standard route, obstacle, and attempt debug layers in draw order. */
export const createLengthMatchingVisualization = (input: LengthMatchingVisualizationInput): GraphicsObject => {
  const graphics: LengthMatchingGraphics = { lines: [], points: [], rects: [], circles: [] }
  const theme = createLengthMatchingColorTheme(input.colorMap)
  buildRouteGraphics({ routes: input.routes, theme, graphics })
  buildObstacleGraphics({ obstacles: input.obstacles, bounds: input.bounds, layerCount: input.layerCount, theme, graphics })
  buildAttemptGraphics({ routes: input.routes, attempt: input.currentAttempt, theme, graphics })
  return { title: "Length matching: linear-regression meander search", ...graphics }
}
