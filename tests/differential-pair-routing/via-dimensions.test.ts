import { expect, test } from "bun:test"
import { DifferentialPairRoutingSolver } from "../../lib"

test("preserves board via pad and drill dimensions in native traces", () => {
  const solver = new DifferentialPairRoutingSolver({
    bounds: { minX: -2, maxX: 6, minY: -2, maxY: 4 },
    layerCount: 2,
    minTraceWidth: 0.15,
    minViaDiameter: 0.5,
    min_via_hole_diameter: 0.25,
    obstacles: [],
    connections: [0, 1].map((index) => ({
      name: `net_${index}`,
      pointsToConnect: [
        { x: 0, y: index * 1.2, layer: "top" },
        { x: 4, y: index * 1.2, layer: "bottom" },
      ],
    })),
    differentialPairs: [
      {
        connectionNames: ["net_0", "net_1"],
        lengthTolerance: 0.1,
      },
    ],
  })
  solver.solve()
  const vias = solver
    .getOutput()
    .routedTraces.flatMap((trace) =>
      trace.route.filter((point) => point.route_type === "via"),
    )
  expect(vias).toHaveLength(2)
  for (const via of vias) {
    expect(via.via_diameter).toBe(0.5)
    expect(via.via_hole_diameter).toBe(0.25)
  }
})
