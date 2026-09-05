import { stackGraphicsVertically, type GraphicsObject } from "graphics-debug"
import { buildObstacleGraphics } from "../../../lib/length-matching/visualization/build-obstacle-graphics"
import { buildRouteGraphics } from "../../../lib/length-matching/visualization/build-route-graphics"
import { createLengthMatchingColorTheme } from "../../../lib/length-matching/visualization/color-theme"
import type { LengthMatchingGraphics } from "../../../lib/length-matching/visualization/types"
import type {
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "../../../lib/post-processing/types"

/** Actual emitted copper in board XY (mm, +Y up), with identical panel scales. */
export const createDeclaredPadClearanceComparison = (
  params: PostProcessingSolverParams,
  legacy: PostProcessingSolverOutput,
  fixed: PostProcessingSolverOutput,
): GraphicsObject => {
  const theme = createLengthMatchingColorTheme({
    source_trace_0: "#2563eb",
    source_trace_1: "#b45309",
  })
  const panels = [legacy, fixed].map((output, panelIndex): GraphicsObject => {
    const graphics: LengthMatchingGraphics = {
      lines: [],
      points: [],
      circles: [],
      rects: [],
    }
    buildObstacleGraphics({
      graphics,
      obstacles: params.obstacles,
      layerCount: params.layerCount,
      theme,
    })
    buildRouteGraphics({ graphics, routes: output.hdRoutes, theme })
    const lengths = output.hdRoutes.map((route) =>
      route.route.slice(1).reduce((length, point, pointIndex) => {
        const previous = route.route[pointIndex]!
        return length + Math.hypot(point.x - previous.x, point.y - previous.y)
      }, 0),
    )
    const skew = Math.abs(lengths[0]! - lengths[1]!)
    const rejected = output.postProcessingErrors.some(
      (error) => error.reason === "invalid-final-copper",
    )
    return {
      ...graphics,
      coordinateSystem: "cartesian",
      // Keep the empty meander area in the legacy panel for direct comparison.
      rects: [
        ...graphics.rects,
        {
          center: { x: 0, y: 1 },
          width: 17,
          height: 11,
          fill: "none",
          stroke: "#cbd5e1",
        },
      ],
      texts: [
        {
          x: -7.7,
          y: 5.8,
          text:
            panelIndex === 0
              ? "BEFORE: inferred pad clearance 0.150 mm (trace width)"
              : "AFTER: declared pad clearance 0.100 mm",
          color: "#0f172a",
          fontSize: 0.35,
          anchorSide: "center_left",
        },
        {
          x: -7.7,
          y: 5.2,
          text: "Same input routes and pads; trace width stays 0.150 mm",
          color: "#475569",
          fontSize: 0.3,
          anchorSide: "center_left",
        },
        ...output.hdRoutes.map((route, index) => ({
          x: -7.7,
          y: -2.7 - index * 0.5,
          text: `${route.connectionName}: ${lengths[index]!.toFixed(3)} mm`,
          color: theme.getConnectionColor(route.connectionName),
          fontSize: 0.3,
          anchorSide: "center_left" as const,
        })),
        {
          x: -7.7,
          y: -3.8,
          text: `Skew ${skew.toFixed(3)} mm / limit 0.050 mm: ${rejected ? "FAIL - matched copper rejected" : "PASS - matched copper retained"}`,
          color: rejected ? "#b91c1c" : "#15803d",
          fontSize: 0.3,
          anchorSide: "center_left",
        },
      ],
    }
  })
  return stackGraphicsVertically(panels)
}
