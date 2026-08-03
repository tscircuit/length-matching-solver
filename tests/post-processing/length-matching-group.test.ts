import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type HighDensityRoute,
  type PostProcessingSolverParams,
} from "../../lib"
import { getRouteLength } from "../../lib/route-geometry"

test("post-processes a routed bus to its declared maximum skew", () => {
  const createRoute = (
    connectionName: string,
    route: HighDensityRoute["route"],
  ): HighDensityRoute => ({
    connectionName,
    traceThickness: 0.15,
    viaDiameter: 0.45,
    route,
    vias: [],
  })
  const params: PostProcessingSolverParams = {
    hdRoutes: [
      createRoute("DQ0", [
        { x: 0, y: 4, z: 0 },
        { x: 4, y: 4, z: 0 },
        { x: 4, y: 6, z: 0 },
        { x: 8, y: 6, z: 0 },
        { x: 8, y: 4, z: 0 },
        { x: 12, y: 4, z: 0 },
      ]),
      createRoute("DQ1", [
        { x: 0, y: 0, z: 0 },
        { x: 12, y: 0, z: 0 },
      ]),
      createRoute("DQ2", [
        { x: 0, y: -4, z: 0 },
        { x: 12, y: -4, z: 0 },
      ]),
    ],
    differentialPairs: [],
    lengthMatchingGroups: [
      {
        connectionNames: ["DQ0", "DQ1", "DQ2"],
        maxLengthSkew: 0.05,
        fixedLengthByConnectionName: { DQ0: 0, DQ1: 1, DQ2: 2 },
      },
    ],
    obstacles: [],
    bounds: { minX: -1, maxX: 13, minY: -9, maxY: 9 },
    layerCount: 2,
  }
  const solver = new PostProcessingSolver(params)

  solver.solve()

  const output = solver.getOutput()
  const lengths = output.hdRoutes.map(
    (route, index) => getRouteLength(route) + index,
  )
  expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(0.05)
  expect(output.hdRoutes[1]!.route.length).toBeGreaterThan(2)
  expect(output.hdRoutes[2]!.route.length).toBeGreaterThan(2)
  expect(solver.finalVisualize()).toMatchGraphicsSvg(import.meta.path)
})
