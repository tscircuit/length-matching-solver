import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib/types"
import { validateCandidateGeometry } from "../../../lib/post-processing/geometry/validateCandidateGeometry"
import { parseSimplifiedPcbTrace } from "../../../lib/post-processing/model/parseSimplifiedPcbTrace"

test("uses the same trace-via clearance regardless of which pair was routed first", (): void => {
  const traces = [0, -2].map((y, index): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `trace-${index}`,
    connection_name: `trace-${index}`,
    route: [
      { route_type: "wire", x: 0, y, width: 0.1, layer: "top" },
      { route_type: "wire", x: 4, y, width: 0.1, layer: "top" },
    ],
  }))
  const vias = [2, 5].map((x, index): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `via-${index}`,
    connection_name: `via-${index}`,
    route: [
      { route_type: "wire", x, y: 1, width: 0.1, layer: "top" },
      { route_type: "wire", x, y: 0.5, width: 0.1, layer: "top" },
      {
        route_type: "via",
        x,
        y: 0.5,
        from_layer: "top",
        to_layer: "bottom",
        via_diameter: 0.45,
      },
      { route_type: "wire", x, y: 0.5, width: 0.1, layer: "bottom" },
      { route_type: "wire", x: x + 1, y: 0.5, width: 0.1, layer: "bottom" },
    ],
  }))
  for (const [pair, immutableTraces] of [[traces, vias], [vias, traces]]) {
    expect(
      validateCandidateGeometry(
        parseSimplifiedPcbTrace(pair![0]!, 2),
        parseSimplifiedPcbTrace(pair![1]!, 2),
        {
          immutableTraces: immutableTraces!,
          obstacles: [],
          bounds: { minX: -2, maxX: 8, minY: -3, maxY: 3 },
          layerCount: 2,
        },
      ),
    ).toBe(true)
  }
})
