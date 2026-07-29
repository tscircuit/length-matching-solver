import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("fails fast on non-positive or non-finite via dimensions", () => {
  for (const [field, value] of [
    ["via_diameter", 0],
    ["via_diameter", Number.NaN],
    ["via_hole_diameter", -0.1],
    ["via_hole_diameter", Number.POSITIVE_INFINITY],
    ["via_hole_diameter", 0.4],
  ] as const) {
    const makeTrace = (name: string, y: number): SimplifiedPcbTrace => ({
      type: "pcb_trace",
      pcb_trace_id: name,
      connection_name: name,
      route: [
        { route_type: "wire", x: 0, y, width: 0.2, layer: "top" },
        {
          route_type: "via",
          x: 5,
          y,
          from_layer: "top",
          to_layer: "bottom",
          via_diameter: 0.4,
          via_hole_diameter: 0.2,
          [field]: value,
        },
        { route_type: "wire", x: 10, y, width: 0.2, layer: "bottom" },
      ],
    })
    const traces = [makeTrace("P", 0.5), makeTrace("N", -0.5)]
    const solver = new PostProcessingSolver(
      createPostProcessingTestParams({ simpleRouteJson: { traces } }),
    )
    expect(() => solver.solve()).toThrow(
      /unsupported or invalid routed geometry/,
    )
    expect(solver.failed).toBe(true)
  }
})
