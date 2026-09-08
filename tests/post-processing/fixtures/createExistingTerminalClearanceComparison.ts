import { stackGraphicsHorizontally, type GraphicsObject } from "graphics-debug"
import { buildObstacleGraphics } from "../../../lib/length-matching/visualization/build-obstacle-graphics"
import { buildRouteGraphics } from "../../../lib/length-matching/visualization/build-route-graphics"
import { createLengthMatchingColorTheme } from "../../../lib/length-matching/visualization/color-theme"
import type { LengthMatchingGraphics } from "../../../lib/length-matching/visualization/types"
import type {
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "../../../lib/post-processing/types"

/** Shows the real USB pair before and after matching around existing terminal copper. */
export const createExistingTerminalClearanceComparison = (
  params: PostProcessingSolverParams,
  output: PostProcessingSolverOutput,
): GraphicsObject => {
  const theme = createLengthMatchingColorTheme({
    source_net_0: "#dc2626",
    source_net_1: "#2563eb",
  })
  const panels: GraphicsObject[] = []
  const routesByPanel = [params.hdRoutes, output.hdRoutes]
  for (let panelIndex = 0; panelIndex < routesByPanel.length; panelIndex++) {
    const routes = routesByPanel[panelIndex]!
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
    buildRouteGraphics({ graphics, routes, theme })
    const lengths = routes.map((route) =>
      route.route.slice(1).reduce((length, point, pointIndex) => {
        const previous = route.route[pointIndex]!
        return length + Math.hypot(point.x - previous.x, point.y - previous.y)
      }, 0),
    )
    const skew = Math.abs(lengths[0]! - lengths[1]!)
    let title = "BEFORE: unchanged routes rejected the new meander"
    let status = `FAIL: ${skew.toFixed(3)} mm skew / 0.500 mm limit`
    let statusColor = "#b91c1c"
    if (panelIndex === 1) {
      title = "AFTER: validate changed copper against the original pair"
      status = `PASS: ${skew.toFixed(3)} mm skew / 0.500 mm limit`
      statusColor = "#15803d"
    }
    panels.push({
      ...graphics,
      coordinateSystem: "cartesian",
      rects: [
        ...graphics.rects,
        {
          center: { x: 0, y: 0 },
          width: params.bounds.maxX - params.bounds.minX,
          height: params.bounds.maxY - params.bounds.minY,
          fill: "none",
          stroke: "#64748b",
        },
      ],
      texts: [
        {
          x: params.bounds.minX + 0.5,
          y: params.bounds.maxY - 0.6,
          text: title,
          color: "#0f172a",
          fontSize: 0.5,
          anchorSide: "center_left",
        },
        {
          x: params.bounds.minX + 0.5,
          y: params.bounds.maxY - 1.4,
          text: status,
          color: statusColor,
          fontSize: 0.45,
          anchorSide: "center_left",
        },
      ],
    })
  }
  return stackGraphicsHorizontally(panels)
}
