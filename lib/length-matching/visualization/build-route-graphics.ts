import type { HighDensityRoute } from "../../types"
import { getLogicalConnectionName } from "../connection-routes"
import type { LengthMatchingColorTheme } from "./color-theme"
import { getGraphicsLayerForRoute } from "./graphics-layers"
import type { LengthMatchingGraphics } from "./types"

/** Append trace and via graphics using the shared color and layer APIs. */
export const buildRouteGraphics = (input: { routes: HighDensityRoute[]; theme: LengthMatchingColorTheme; graphics: LengthMatchingGraphics }): void => {
  for (const route of input.routes) {
    const connectionName = getLogicalConnectionName(route)
    const connectionColor = input.theme.getConnectionColor(connectionName, route.connectionName)
    for (let index = 0; index < route.route.length - 1; index++) {
      const start = route.route[index]!
      const end = route.route[index + 1]!
      if (start.z !== end.z) continue
      input.graphics.lines.push({ points: [start, end], strokeColor: start.z === 0 ? connectionColor : input.theme.getInnerLayerConnectionColor(connectionColor), strokeWidth: route.traceThickness, ...(start.z === 0 ? {} : { strokeDash: [0.2, 0.2] }), layer: getGraphicsLayerForRoute(start.z) })
    }
    const routeLayers = [...new Set(route.route.map((point) => point.z))]
    for (const via of route.vias) input.graphics.circles.push({ center: via, radius: route.viaDiameter / 2, fill: input.theme.via.fill, stroke: input.theme.via.stroke, layer: `z${routeLayers.join(",")}` })
  }
}
