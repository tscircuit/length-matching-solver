import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("post-processes a pair with an isolated four-layer stitching via", () => {
  const params = createPostProcessingTestParams({
    simpleRouteJson: { layerCount: 4 },
  })
  const stitchingVia: SimplifiedPcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "stitch",
    connection_name: "GND",
    route: [
      {
        route_type: "via",
        x: 5,
        y: 0,
        from_layer: "top",
        to_layer: "bottom",
        via_diameter: 0.45,
        via_hole_diameter: 0.2,
      },
    ],
  }
  const solver = new PostProcessingSolver({ ...params, traces: [stitchingVia] })
  expect(() => solver.solve()).toThrow("discontinuous via")
  expect(solver.initialVisualize()).toMatchGraphicsSvg(import.meta.path)
})
