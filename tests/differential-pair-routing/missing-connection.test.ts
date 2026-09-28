import { expect, test } from "bun:test"
import { DifferentialPairRoutingSolver } from "../../lib"

test("fails instead of returning incomplete differential-pair geometry", () => {
  const solver = new DifferentialPairRoutingSolver({
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [],
    connections: [],
    differentialPairs: [{ connectionNames: ["missing", "other"], lengthTolerance: 0.1 }],
  })
  expect(() => solver.solve()).toThrow('missing connection "missing"')
  expect(solver.solved).toBe(false)
  expect(() => solver.getOutput()).toThrow("before completion")
})
