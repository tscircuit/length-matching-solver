import { expect, test } from "bun:test"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { getRouteLength } from "../lib/route-geometry"

test("matches across redundant collinear route points", (): void => {
  const params: LengthMatchingSolverParams = {
    hdRoutes: [
      {
        connectionName: "long",
        traceThickness: 0.15,
        viaDiameter: 0.6,
        route: [
          { x: 0, y: 5, z: 0 },
          { x: 7, y: 5, z: 0 },
        ],
        vias: [],
      },
      {
        connectionName: "short",
        traceThickness: 0.15,
        viaDiameter: 0.6,
        route: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 2, y: 0, z: 0 },
          { x: 3, y: 0, z: 0 },
          { x: 4, y: 0, z: 0 },
          { x: 5, y: 0, z: 0 },
        ],
        vias: [],
      },
    ],
    originalConnections: [
      {
        name: "long",
        pointsToConnect: [
          { x: 0, y: 5, layer: "top" },
          { x: 7, y: 5, layer: "top" },
        ],
      },
      {
        name: "short",
        pointsToConnect: [
          { x: 0, y: 0, layer: "top" },
          { x: 5, y: 0, layer: "top" },
        ],
      },
    ],
    differentialPairs: [
      {
        connectionNames: ["long", "short"],
        lengthTolerance: 0.01,
      },
    ],
    obstacles: [],
    bounds: { minX: -1, maxX: 8, minY: -3, maxY: 8 },
    obstacleMargin: 0.1,
    layerCount: 2,
  }
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(
    Math.abs(
      getRouteLength(solver.matchedHdRoutes[0]!) -
        getRouteLength(solver.matchedHdRoutes[1]!),
    ),
  ).toBeLessThanOrEqual(0.01)
})
