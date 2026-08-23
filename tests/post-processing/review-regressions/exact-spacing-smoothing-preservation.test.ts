import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { FortyFiveDegreeSimplificationSolver } from "../../../lib/post-processing/solvers/FortyFiveDegreeSimplificationSolver"

test("does not independently simplify members of an exact-spacing pair", () => {
  const traces: SimplifiedPcbTrace[] = [
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_p",
      connection_name: "P",
      route: [
        { route_type: "wire", x: 12, y: 1, width: 0.15, layer: "top" },
        { route_type: "wire", x: 10, y: 0.15, width: 0.15, layer: "top" },
        { route_type: "wire", x: 4, y: 0.15, width: 0.15, layer: "top" },
        { route_type: "wire", x: 2, y: -1.85, width: 0.15, layer: "top" },
        { route_type: "wire", x: 0, y: -1.75, width: 0.15, layer: "top" },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_n",
      connection_name: "N",
      route: [
        { route_type: "wire", x: 12, y: 0, width: 0.15, layer: "top" },
        { route_type: "wire", x: 10, y: -0.15, width: 0.15, layer: "top" },
        { route_type: "wire", x: 4, y: -0.15, width: 0.15, layer: "top" },
        { route_type: "wire", x: 2, y: -2.15, width: 0.15, layer: "top" },
        { route_type: "wire", x: 0, y: -2.25, width: 0.15, layer: "top" },
      ],
    },
  ]
  const solver = new FortyFiveDegreeSimplificationSolver({
    traces,
    reroutedPairs: [
      {
        connectionNames: ["P", "N"],
        lengthTolerance: 0.5,
        maxUncoupledLength: 3,
        minimumCenterlineDistance: 0.3,
        maximumCenterlineDistance: 0.3,
      },
    ],
    obstacles: [],
    bounds: { minX: -1, maxX: 13, minY: -3, maxY: 2 },
    layerCount: 2,
  })

  solver.solve()

  expect(solver.getOutput().traces).toEqual(traces)
})
