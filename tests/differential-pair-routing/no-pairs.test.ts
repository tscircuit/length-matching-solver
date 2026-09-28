import { expect, test } from "bun:test"
import { DifferentialPairRoutingSolver } from "../../lib"

test("passes through a native SRJ with no differential pairs", () => {
  const srj = {
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [],
    connections: [],
    buses: [{ busId: "bus", connectionNames: [], maxLengthSkew: 0.1 }],
  }
  const solver = new DifferentialPairRoutingSolver(srj)
  solver.solve()
  expect(solver.getOutput()).toEqual({ srj, routedTraces: [] })
  expect(solver.iterations).toBe(0)
})
