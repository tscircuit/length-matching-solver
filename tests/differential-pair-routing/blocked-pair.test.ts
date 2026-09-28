import { expect, test } from "bun:test"
import { DifferentialPairRoutingSolver } from "../../lib"

test("fails when a differential pair has no route through the board", () => {
  const solver = new DifferentialPairRoutingSolver({
    bounds: { minX: -1, maxX: 5, minY: -1, maxY: 3 },
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [{
      type: "rect",
      layers: ["top", "bottom"],
      center: { x: 2, y: 1 },
      width: 1,
      height: 4,
      connectedTo: [],
    }],
    connections: [0, 1].map((index) => ({
      name: `net_${index}`,
      pointsToConnect: [
        { x: 0, y: index * 1.2, layer: "top" },
        { x: 4, y: index * 1.2, layer: "top" },
      ],
    })),
    differentialPairs: [{
      connectionNames: ["net_0", "net_1"],
      lengthTolerance: 0.1,
    }],
  })
  expect(() => solver.solve()).toThrow("could not be improved")
  expect(solver.solved).toBe(false)
  expect(() => solver.getOutput()).toThrow("before completion")
})
