import { getLayerIndex } from "../post-processing/geometry/getLayerIndex"
import type { CoupledPathPoint } from "../post-processing/routing/types"
import type {
  HighDensityRoute,
  SimplifiedPcbTrace,
  SimplifiedPcbTraceRoutePoint,
} from "../types"
import type { TraceRoutingConnection } from "./types"

/**
 * Convert one searched centerline into its native HD route and the simplified
 * copper later searches must clear.
 */
export const createRoutedTrace = (input: {
  connection: TraceRoutingConnection
  path: CoupledPathPoint[]
  layerCount: number
}): { hdRoute: HighDensityRoute; trace: SimplifiedPcbTrace } => {
  const { connection, path, layerCount } = input
  if (path.length < 2)
    throw new Error(
      `TraceRoutingSolver: connection "${connection.connectionName}" produced a path with fewer than two points`,
    )
  const startPortId = connection.start.pcb_port_id
  const endPortId = connection.end.pcb_port_id
  const hdRoute: HighDensityRoute = {
    connectionName: connection.connectionName,
    ...(connection.rootConnectionName
      ? { rootConnectionName: connection.rootConnectionName }
      : {}),
    ...(startPortId ? { startPcbPortId: startPortId } : {}),
    ...(endPortId ? { endPcbPortId: endPortId } : {}),
    traceThickness: connection.traceThickness,
    viaDiameter: connection.viaDiameter,
    route: path.map((point, index) => {
      const portId =
        index === 0
          ? startPortId
          : index === path.length - 1
            ? endPortId
            : undefined
      return {
        x: point.x,
        y: point.y,
        z: getLayerIndex(point.layer, layerCount),
        ...(portId ? { pcb_port_id: portId } : {}),
      }
    }),
    vias: [],
  }
  const route: SimplifiedPcbTraceRoutePoint[] = []
  for (const [index, point] of path.entries()) {
    const previous = path[index - 1]
    if (previous && previous.layer !== point.layer) {
      const zLayers = [previous.layer, point.layer]
        .map((layer) => getLayerIndex(layer, layerCount))
        .sort((left, right) => left - right)
      hdRoute.vias.push({ x: point.x, y: point.y, zLayers })
      route.push({
        route_type: "via",
        x: point.x,
        y: point.y,
        from_layer: previous.layer,
        to_layer: point.layer,
        via_diameter: connection.viaDiameter,
      })
    }
    route.push({
      route_type: "wire",
      x: point.x,
      y: point.y,
      width: connection.traceThickness,
      layer: point.layer,
    })
  }
  return {
    hdRoute,
    trace: {
      type: "pcb_trace",
      pcb_trace_id: `trace_routing_${connection.connectionName}`,
      connection_name:
        connection.rootConnectionName ?? connection.connectionName,
      route,
    },
  }
}
