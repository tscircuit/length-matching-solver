import type { PcbTraceRoutePoint, PcbTraceWireRoutePoint } from "../types"

export const getPlanarRouteLength = (route: PcbTraceRoutePoint[]): number => {
  let routeLength = 0
  let lastWire: PcbTraceWireRoutePoint | undefined
  for (const routePoint of route) {
    if (routePoint.route_type === "via") {
      lastWire = undefined
    } else if (routePoint.route_type === "wire") {
      if (lastWire && lastWire.layer === routePoint.layer) {
        routeLength += Math.hypot(
          routePoint.x - lastWire.x,
          routePoint.y - lastWire.y,
        )
      }
      lastWire = routePoint
    }
  }
  return routeLength
}
