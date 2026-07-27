import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("preserves endpoint connectivity and port metadata for terminal-via traces", () => {
  const makeTrace = (
    id: string,
    name: string,
    y: number,
  ): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: id,
    connection_name: name,
    route: [
      {
        route_type: "via",
        x: 0,
        y,
        from_layer: "top",
        to_layer: "bottom",
        via_diameter: 0.4,
      },
      {
        route_type: "wire",
        x: 0,
        y,
        width: 0.2,
        layer: "bottom",
        start_pcb_port_id: `${id}_start`,
      },
      {
        route_type: "wire",
        x: 10,
        y,
        width: 0.2,
        layer: "bottom",
        end_pcb_port_id: `${id}_end`,
      },
      {
        route_type: "via",
        x: 10,
        y,
        from_layer: "bottom",
        to_layer: "top",
        via_diameter: 0.4,
      },
    ],
  })
  const solver = new PostProcessingSolver(
    createPostProcessingTestParams({
      traces: [makeTrace("p", "P", 0.5), makeTrace("n", "N", -0.5)],
    }),
  )
  solver.solve()
  const output = solver.getOutput()
  expect(output.errors).toHaveLength(0)
  for (const trace of output.traces) {
    const wires = trace.route.filter((entry) => entry.route_type === "wire")
    expect(wires[0]!.layer).toBe("top")
    expect(wires.at(-1)!.layer).toBe("top")
    expect(wires[0]!.start_pcb_port_id).toBe(`${trace.pcb_trace_id}_start`)
    expect(wires.at(-1)!.end_pcb_port_id).toBe(`${trace.pcb_trace_id}_end`)
  }
})
