import type { SimplifiedPcbTrace, SimplifiedPcbTraces } from "../types"
import type { DifferentialPairRoutingSrj } from "./types"

/** Endpoint scaffolds provide terminal geometry to the coupled path search. */
export function createPairTerminalTraces(
  connections: DifferentialPairRoutingSrj["connections"],
  srj: DifferentialPairRoutingSrj,
): SimplifiedPcbTraces {
  return connections.map((connection): SimplifiedPcbTrace => {
    if (connection.pointsToConnect.length !== 2)
      throw new Error(
        `DifferentialPairRoutingSolver: "${connection.name}" must have two terminals`,
      )
    const [start, end] = connection.pointsToConnect
    const startLayer = "layer" in start! ? start!.layer : start!.layers[0]
    const endLayer = "layer" in end! ? end!.layer : end!.layers[0]
    if (!startLayer || !endLayer)
      throw new Error(
        `DifferentialPairRoutingSolver: "${connection.name}" has no terminal layer`,
      )
    const width =
      connection.nominalTraceWidth ?? srj.nominalTraceWidth ?? srj.minTraceWidth
    const viaDiameter = Math.max(
      srj.min_via_pad_diameter ??
        srj.minViaPadDiameter ??
        srj.minViaDiameter ??
        0.3,
      srj.min_via_hole_diameter ?? srj.minViaHoleDiameter ?? 0,
    )
    const trace: SimplifiedPcbTrace = {
      type: "pcb_trace",
      pcb_trace_id: `differential_pair_${connection.name}`,
      connection_name: connection.name,
      connectsTo: [
        connection.name,
        connection.__netConnectionName,
        ...(connection.__rootConnectionNames ?? []),
        ...connection.pointsToConnect.flatMap((point) => [
          point.pcb_port_id,
          point.pointId,
        ]),
      ].filter((name): name is string => name !== undefined),
      __postProcessingViaDiameter: viaDiameter,
      route: [
        {
          route_type: "wire",
          x: start!.x,
          y: start!.y,
          layer: startLayer,
          width,
          start_pcb_port_id: start!.pcb_port_id,
        },
      ],
    }
    if (startLayer !== endLayer)
      trace.route.push({
        route_type: "via",
        x: start!.x,
        y: start!.y,
        from_layer: startLayer,
        to_layer: endLayer,
        via_diameter: viaDiameter,
      })
    trace.route.push({
      route_type: "wire",
      x: end!.x,
      y: end!.y,
      layer: endLayer,
      width,
      end_pcb_port_id: end!.pcb_port_id,
    })
    return trace
  })
}
