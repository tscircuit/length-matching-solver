import { expect, test } from "bun:test"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib"

test("preserves carriers whose complete lengths already match", (): void => {
  const params: LengthMatchingSolverParams = {
    hdRoutes: [
      {
        connectionName: "a",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        route: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        vias: [],
      },
      {
        connectionName: "b",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        route: [
          { x: 0, y: 10, z: 0 },
          { x: 10, y: 10, z: 0 },
        ],
        vias: [],
      },
    ],
    originalConnections: [
      {
        name: "a",
        pointsToConnect: [
          { x: 0, y: 0, layer: "top" },
          { x: 1, y: 0, layer: "top" },
        ],
      },
      {
        name: "b",
        pointsToConnect: [
          { x: 0, y: 10, layer: "top" },
          { x: 10, y: 10, layer: "top" },
        ],
      },
    ],
    differentialPairs: [{ connectionNames: ["a", "b"], lengthTolerance: 0.01 }],
    fixedLengthByConnectionName: { a: 9 },
  }
  const solver = new LengthMatchingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.getOutput().matchedHdRoutes).toEqual(params.hdRoutes)
})
