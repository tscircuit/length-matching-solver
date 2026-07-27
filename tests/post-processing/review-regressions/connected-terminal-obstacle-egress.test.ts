import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("routes out of obstacles connected to the active pair terminals", () => {
  const makeTrace = (name: string, y: number): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: name,
    connection_name: name,
    route: [
      { route_type: "wire", x: 0, y, width: 0.2, layer: "top" },
      { route_type: "wire", x: 10, y, width: 0.2, layer: "top" },
    ],
  })
  const traces = [makeTrace("P", 0.475), makeTrace("N", -0.475)]
  const obstacles = traces.flatMap((trace) => {
    const y = trace.route[0]!.route_type === "wire" ? trace.route[0]!.y : 0
    return [0, 10].map((x) => ({
      type: "rect" as const,
      layers: ["top"],
      center: { x, y },
      width: 0.6,
      height: 0.6,
      connectedTo: [trace.connection_name],
    }))
  })
  const solver = new PostProcessingSolver(
    createPostProcessingTestParams({ traces, obstacles }),
  )
  solver.solve()
  expect(solver.getOutput().errors).toHaveLength(0)
})
