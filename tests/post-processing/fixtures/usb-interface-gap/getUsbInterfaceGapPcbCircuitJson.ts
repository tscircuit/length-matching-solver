import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import type { HighDensityRoute } from "../../../../lib"

/** Render emitted copper on the native core-generated board and footprints. */
export function getUsbInterfaceGapPcbCircuitJson(
  board: AnyCircuitElement[],
  hdRoutes: HighDensityRoute[],
): AnyCircuitElement[] {
  const traces = hdRoutes.map((trace, index): PcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `usb_gap_trace_${index}`,
    source_trace_id: trace.connectionName,
    route: trace.route.map((point): PcbTrace["route"][number] => {
      if (point.z !== 0)
        throw new Error("The captured USB pair must stay on the top layer")
      return {
        route_type: "wire",
        x: point.x,
        y: point.y,
        width: point.traceThickness ?? trace.traceThickness,
        layer: "top",
      }
    }),
  }))
  return [...board, ...traces]
}
