import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../lib"
import { getMinimumSegmentDistance } from "../../lib/route-geometry"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("detours with explicit clearance from immutable unrelated copper", () => {
  const blocker: SimplifiedPcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "blocker",
    connection_name: "OTHER",
    route: [
      { route_type: "wire", x: 7.5, y: -3.5, width: 0.2, layer: "top" },
      { route_type: "wire", x: 7.5, y: 3.5, width: 0.2, layer: "top" },
    ],
  }
  const params = createPostProcessingTestParams()
  const solver = new PostProcessingSolver(createPostProcessingTestParams({
    traces: [...params.traces, blocker],
    obstacles: [{ type: "rect", layers: ["top", "bottom"], center: { x: 4, y: 0 }, width: 1.5, height: 3, connectedTo: [] }],
  }))
  solver.solve()
  const output = solver.getOutput()
  expect(output.errors).toHaveLength(0)
  expect(output.traces[2]).toEqual(blocker)
  for (const trace of output.traces.slice(0, 2)) {
    for (let index = 0; index < trace.route.length - 1; index++) {
      const start = trace.route[index]
      const end = trace.route[index + 1]
      if (start?.route_type !== "wire" || end?.route_type !== "wire" || start.layer !== "top" || end.layer !== "top") continue
      expect(getMinimumSegmentDistance(
        start,
        end,
        blocker.route[0] as { x: number; y: number },
        blocker.route[1] as { x: number; y: number },
      )).toBeGreaterThanOrEqual(0.4 - 1e-7)
    }
  }
})
