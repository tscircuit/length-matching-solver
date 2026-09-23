import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../lib"
import { getMinimumSegmentDistance } from "../../lib/route-geometry"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("detours around native fixed traces without tuning or returning them", (): void => {
  const blocker: SimplifiedPcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "fixed",
    connection_name: "P",
    route: [
      { route_type: "wire", x: 7.5, y: -3.5, layer: "top", width: 0.2 },
      { route_type: "wire", x: 7.5, y: 3.5, layer: "top", width: 0.2 },
    ],
  }
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const originalBlocker = structuredClone(blocker)
  const solver = new PostProcessingSolver({
    ...params,
    traces: [blocker],
    obstacles: [
      {
        type: "rect",
        layers: ["top", "bottom"],
        center: { x: 4, y: 0 },
        width: 1.5,
        height: 3,
        connectedTo: [],
      },
    ],
  })
  solver.solve()
  const { hdRoutes } = solver.getOutput()
  expect(hdRoutes).toHaveLength(2)
  expect(blocker).toEqual(originalBlocker)
  expect(solver.getOutput().postProcessingErrors).toEqual([])
  for (const hdRoute of hdRoutes.slice(0, 2)) {
    for (let index = 0; index < hdRoute.route.length - 1; index++) {
      const start = hdRoute.route[index]
      const end = hdRoute.route[index + 1]
      if (!start || !end || start.z !== 0 || end.z !== 0) continue
      expect(
        getMinimumSegmentDistance(
          start,
          end,
          { x: 7.5, y: -3.5 },
          { x: 7.5, y: 3.5 },
        ),
      ).toBeGreaterThanOrEqual(0.4 - 1e-7)
    }
  }
})
