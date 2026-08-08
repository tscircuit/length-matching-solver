import type {
  SimplifiedPcbTrace,
  SimplifiedPcbTraceRoutePoint,
} from "../../types"
import { getLayerName } from "../geometry/getLayerName"
import type { PostProcessingModel, PostProcessingSolverParams } from "../types"

/** Adapt native HD routes to the private simplified-copper routing model. */
export const createPostProcessingModel = (
  params: PostProcessingSolverParams,
): PostProcessingModel => {
  const internalNamesByRouteIndex = new Map<number, string>()
  for (const pair of params.differentialPairs) {
    for (const connectionName of pair.connectionNames) {
      const matches = params.hdRoutes
        .map((route, hdRouteIndex) => ({ route, hdRouteIndex }))
        .filter(({ route }) => route.connectionName === connectionName)
      if (matches.length !== 1)
        throw new Error(
          `PostProcessingSolver: differential pair connection "${connectionName}" lost its unique HD route binding`,
        )
      internalNamesByRouteIndex.set(matches[0]!.hdRouteIndex, connectionName)
    }
  }

  const traces: SimplifiedPcbTrace[] = params.hdRoutes.map(
    (hdRoute, hdRouteIndex) => {
      const route: SimplifiedPcbTraceRoutePoint[] = []
      const jumperByStartIndex = new Map<
        number,
        { endIndex: number; jumperIndex: number }
      >()
      for (
        let jumperIndex = 0;
        jumperIndex < (hdRoute.jumpers?.length ?? 0);
        jumperIndex++
      ) {
        const jumper = hdRoute.jumpers![jumperIndex]!
        const startIndexes = hdRoute.route
          .map((point, index) => ({ point, index }))
          .filter(
            ({ point }) =>
              Math.hypot(point.x - jumper.start.x, point.y - jumper.start.y) <=
              1e-8,
          )
          .map(({ index }) => index)
        const endIndexes = hdRoute.route
          .map((point, index) => ({ point, index }))
          .filter(
            ({ point }) =>
              Math.hypot(point.x - jumper.end.x, point.y - jumper.end.y) <=
              1e-8,
          )
          .map(({ index }) => index)
        const forward = startIndexes.flatMap((startIndex) =>
          endIndexes
            .filter((endIndex) => endIndex > startIndex)
            .map((endIndex) => ({ startIndex, endIndex })),
        )
        const reverse = endIndexes.flatMap((startIndex) =>
          startIndexes
            .filter((endIndex) => endIndex > startIndex)
            .map((endIndex) => ({ startIndex, endIndex })),
        )
        const spans = [...forward, ...reverse]
        if (spans.length !== 1)
          throw new Error(
            `PostProcessingSolver: immutable HD route "${hdRoute.connectionName}" has an ambiguous jumper traversal`,
          )
        const span = spans[0]!
        if (
          jumperByStartIndex.has(span.startIndex) ||
          [...jumperByStartIndex.values()].some(
            ({ endIndex }) =>
              span.startIndex < endIndex || span.endIndex <= endIndex,
          )
        )
          throw new Error(
            `PostProcessingSolver: immutable HD route "${hdRoute.connectionName}" has overlapping or unordered jumpers`,
          )
        jumperByStartIndex.set(span.startIndex, {
          endIndex: span.endIndex,
          jumperIndex,
        })
      }

      if (hdRoute.route.length > 0) {
        const first = hdRoute.route[0]!
        route.push({
          route_type: "wire",
          x: first.x,
          y: first.y,
          width: first.traceThickness ?? hdRoute.traceThickness,
          layer: getLayerName(first.z, params.layerCount),
        })
        for (
          let pointIndex = 0;
          pointIndex < hdRoute.route.length - 1;
          pointIndex++
        ) {
          const point = hdRoute.route[pointIndex]!
          const jumperSpan = jumperByStartIndex.get(pointIndex)
          if (jumperSpan) {
            const end = hdRoute.route[jumperSpan.endIndex]!
            const jumper = hdRoute.jumpers![jumperSpan.jumperIndex]!
            if (point.z !== end.z)
              throw new Error(
                `PostProcessingSolver: immutable HD route "${hdRoute.connectionName}" changes layers through a jumper`,
              )
            route.push({
              route_type: "jumper",
              start: { x: point.x, y: point.y },
              end: { x: end.x, y: end.y },
              footprint: jumper.footprint,
              layer: getLayerName(point.z, params.layerCount),
            })
            route.push({
              route_type: "wire",
              x: end.x,
              y: end.y,
              width: end.traceThickness ?? hdRoute.traceThickness,
              layer: getLayerName(end.z, params.layerCount),
            })
            pointIndex = jumperSpan.endIndex - 1
            continue
          }
          const next = hdRoute.route[pointIndex + 1]!
          const currentLayer = getLayerName(point.z, params.layerCount)
          const nextLayer = getLayerName(next.z, params.layerCount)
          if (point.z !== next.z) {
            if (point.toNextSegmentType === "through_obstacle")
              route.push({
                route_type: "through_obstacle",
                start: { x: point.x, y: point.y },
                end: { x: next.x, y: next.y },
                from_layer: currentLayer,
                to_layer: nextLayer,
                width: point.traceThickness ?? hdRoute.traceThickness,
              })
            else
              route.push({
                route_type: "via",
                x: next.x,
                y: next.y,
                from_layer: currentLayer,
                to_layer: nextLayer,
                via_diameter: hdRoute.viaDiameter,
              })
          }
          route.push({
            route_type: "wire",
            x: next.x,
            y: next.y,
            width: next.traceThickness ?? hdRoute.traceThickness,
            layer: nextLayer,
          })
        }
        const wires = route.filter((entry) => entry.route_type === "wire")
        const startPortId =
          hdRoute.startPcbPortId ?? hdRoute.route[0]?.pcb_port_id
        const endPortId =
          hdRoute.endPcbPortId ?? hdRoute.route.at(-1)?.pcb_port_id
        if (startPortId && wires[0]) wires[0].start_pcb_port_id = startPortId
        if (endPortId && wires.at(-1)) wires.at(-1)!.end_pcb_port_id = endPortId
      }
      return {
        type: "pcb_trace",
        pcb_trace_id: `post_processing_hd_route_${hdRouteIndex}`,
        connection_name: hdRoute.connectionName,
        __postProcessingViaDiameter: hdRoute.viaDiameter,
        route,
      }
    },
  )
  const obstacles = structuredClone(params.obstacles)
  for (
    let hdRouteIndex = 0;
    hdRouteIndex < params.hdRoutes.length;
    hdRouteIndex++
  ) {
    const hdRoute = params.hdRoutes[hdRouteIndex]!
    const aliases = new Set(
      [
        hdRoute.connectionName,
        hdRoute.rootConnectionName,
        hdRoute.startPcbPortId,
        hdRoute.endPcbPortId,
        hdRoute.route[0]?.pcb_port_id,
        hdRoute.route.at(-1)?.pcb_port_id,
        internalNamesByRouteIndex.get(hdRouteIndex),
      ].filter((name): name is string => name !== undefined),
    )
    for (const obstacle of obstacles) {
      if (!obstacle.connectedTo.some((name) => aliases.has(name))) continue
      obstacle.connectedTo = [...new Set([...obstacle.connectedTo, ...aliases])]
    }
  }
  return {
    params: {
      simpleRouteJson: {
        traces,
        differentialPairs: structuredClone(params.differentialPairs),
        obstacles,
        bounds: structuredClone(params.bounds),
        layerCount: params.layerCount,
      },
      ...(params.routingGrid
        ? { routingGrid: structuredClone(params.routingGrid) }
        : {}),
    },
    routeBindings: [...internalNamesByRouteIndex.entries()].map(
      ([hdRouteIndex, internalConnectionName]) => ({
        hdRouteIndex,
        traceIndex: hdRouteIndex,
        internalConnectionName,
      }),
    ),
    sourceHdRoutes: structuredClone(params.hdRoutes),
  }
}
