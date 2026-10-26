import { expect, test } from "bun:test"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../../lib"
import { getRouteLength } from "../../lib/route-geometry"

test("treats a prototype-named connection without an own offset as zero fixed length", (): void => {
  const params: LengthMatchingSolverParams = {
    hdRoutes: [
      {
        connectionName: "toString",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        route: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
        vias: [],
      },
      {
        connectionName: "b",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        route: [
          { x: 0, y: 10, z: 0 },
          { x: 8, y: 10, z: 0 },
        ],
        vias: [],
      },
    ],
    originalConnections: [
      {
        name: "toString",
        pointsToConnect: [
          { x: 0, y: 0, layer: "top" },
          { x: 10, y: 0, layer: "top" },
        ],
      },
      {
        name: "b",
        pointsToConnect: [
          { x: 0, y: 10, layer: "top" },
          { x: 8, y: 10, layer: "top" },
        ],
      },
    ],
    differentialPairs: [
      { connectionNames: ["toString", "b"], lengthTolerance: 0.01 },
    ],
    fixedLengthByConnectionName: { b: 2 },
  }
  const solver = new LengthMatchingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.getOutput().matchedHdRoutes).toEqual(params.hdRoutes)
  const route = solver.getOutput().matchedHdRoutes[0]
  if (!route) throw new Error("Expected the prototype-named carrier")
  expect(Number.isFinite(getRouteLength(route))).toBe(true)
})
