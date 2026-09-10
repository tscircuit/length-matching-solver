import { expect, test } from "bun:test"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { getRouteLength } from "../lib/route-geometry"

test("includes immutable route length when selecting the shorter connection", () => {
  const params: LengthMatchingSolverParams = {
    hdRoutes: [
      {
        connectionName: "A",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        vias: [],
        route: [
          { x: 0, y: 1, z: 0, traceThickness: 0.1 },
          { x: 8, y: 1, z: 0, traceThickness: 0.1 },
        ],
      },
      {
        connectionName: "B",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        vias: [],
        route: [
          { x: 0, y: -1, z: 0, traceThickness: 0.1 },
          { x: 7, y: -1, z: 0, traceThickness: 0.1 },
        ],
      },
    ],
    originalConnections: [
      {
        name: "A",
        pointsToConnect: [
          { x: 0, y: 1, layer: "top" },
          { x: 8, y: 1, layer: "top" },
        ],
      },
      {
        name: "B",
        pointsToConnect: [
          { x: 0, y: -1, layer: "top" },
          { x: 7, y: -1, layer: "top" },
        ],
      },
    ],
    differentialPairs: [{ connectionNames: ["A", "B"], lengthTolerance: 0.01 }],
    connectionLengthOffsets: { A: 0, B: 2 },
    obstacles: [],
    bounds: { minX: -1, maxX: 9, minY: -5, maxY: 5 },
    obstacleMargin: 0.1,
    layerCount: 2,
  }
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(getRouteLength(solver.matchedHdRoutes[0]!)).toBeCloseTo(9, 2)
  expect(getRouteLength(solver.matchedHdRoutes[1]!)).toBe(7)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
