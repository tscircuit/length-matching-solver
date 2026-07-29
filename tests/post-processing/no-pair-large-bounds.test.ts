import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../lib"

test("passes through a no-pair board without creating an unused routing grid", () => {
  const params: PostProcessingSolverParams = {
    hdRoutes: [
      {
        connectionName: "ROUTE",
        traceThickness: 0.2,
        viaDiameter: 0.3,
        route: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        vias: [],
      },
    ],
    differentialPairs: [],
    obstacles: [],
    bounds: { minX: 0, maxX: 130, minY: 0, maxY: 130 },
    layerCount: 2,
  }
  const solver = new PostProcessingSolver(params)
  solver.solve()

  expect(solver.getOutput().hdRoutes).toEqual(params.hdRoutes)
})
