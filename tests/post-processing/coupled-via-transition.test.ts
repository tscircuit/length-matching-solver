import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("emits corresponding transitions and equal via counts for both members", () => {
  const makeTrace = (
    id: string,
    name: string,
    y: number,
  ): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: id,
    connection_name: name,
    route: [
      { route_type: "wire", x: 0, y, width: 0.2, layer: "top" },
      {
        route_type: "via",
        x: 5,
        y,
        from_layer: "top",
        to_layer: "bottom",
        via_diameter: 0.5,
        via_hole_diameter: 0.25,
      },
      { route_type: "wire", x: 10, y, width: 0.2, layer: "bottom" },
    ],
  })
  const solver = new PostProcessingSolver(
    createPostProcessingTestParams({
      simpleRouteJson: {
        traces: [makeTrace("p", "P", 0.5), makeTrace("n", "N", -0.5)],
      },
    }),
  )
  solver.solve()
  const output = solver.getOutput()
  const vias = output.simpleRouteJson.traces.map((trace) =>
    trace.route.filter((entry) => entry.route_type === "via"),
  )
  expect(vias[0]!.length).toBeGreaterThan(0)
  expect(vias[0]!.length).toBe(vias[1]!.length)
  expect(vias[0]!.map((via) => `${via.from_layer}/${via.to_layer}`)).toEqual(
    vias[1]!.map((via) => `${via.from_layer}/${via.to_layer}`),
  )
  expect(vias.flat().every((via) => via.via_diameter === 0.5)).toBe(true)
  expect(vias.flat().every((via) => via.via_hole_diameter === 0.25)).toBe(true)
  for (let index = 0; index < vias[0]!.length; index++) {
    expect(
      Math.hypot(
        vias[0]![index]!.x - vias[1]![index]!.x,
        vias[0]![index]!.y - vias[1]![index]!.y,
      ),
    ).toBeGreaterThan(0.5)
  }
})
