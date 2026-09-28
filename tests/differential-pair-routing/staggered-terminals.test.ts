import { expect, test } from "bun:test"
import { DifferentialPairRoutingSolver } from "../../lib"

test("routes staggered terminal pairs without a terminal escape limit", () => {
  const solver = new DifferentialPairRoutingSolver({
    bounds: { minX: -10, maxX: 10, minY: -10, maxY: 10 },
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [],
    connections: [
      {
        name: "positive",
        pointsToConnect: [
          { x: -7.15, y: 1.905, layer: "top" },
          { x: 2.85, y: 1.905, layer: "top" },
        ],
      },
      {
        name: "negative",
        pointsToConnect: [
          { x: -7.15, y: 0.635, layer: "top" },
          { x: 7.15, y: -0.635, layer: "top" },
        ],
      },
    ],
    differentialPairs: [{
      connectionNames: ["positive", "negative"],
      lengthTolerance: 0.05,
    }],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput().routedTraces).toHaveLength(2)
})
