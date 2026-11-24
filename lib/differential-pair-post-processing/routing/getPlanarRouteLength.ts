import type { PcbTraceRoutePoint, PcbTraceWireRoutePoint } from "../types"

export const getPlanarRouteLength = (route: PcbTraceRoutePoint[]): number => {
  let routeLength = 0
  let lastWire: PcbTraceWireRoutePoint | undefined
  let lastVia: Extract<PcbTraceRoutePoint, { route_type: "via" }> | undefined
  for (const routePoint of route) {
    if (routePoint.route_type === "via") {
      if (
        lastWire &&
        (lastWire.layer === routePoint.from_layer ||
          lastWire.layer === routePoint.to_layer)
      ) {
        routeLength += Math.hypot(
          routePoint.x - lastWire.x,
          routePoint.y - lastWire.y,
        )
      }
      lastWire = undefined
      lastVia = routePoint
    } else if (routePoint.route_type === "wire") {
      if (lastWire && lastWire.layer === routePoint.layer) {
        routeLength += Math.hypot(
          routePoint.x - lastWire.x,
          routePoint.y - lastWire.y,
        )
      } else if (
        lastVia &&
        (routePoint.layer === lastVia.from_layer ||
          routePoint.layer === lastVia.to_layer)
      ) {
        routeLength += Math.hypot(
          routePoint.x - lastVia.x,
          routePoint.y - lastVia.y,
        )
      }
      lastWire = routePoint
      lastVia = undefined
    } else {
      lastWire = undefined
      lastVia = undefined
    }
  }
  return routeLength
}
