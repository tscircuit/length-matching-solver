import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../lib"

test("preserves an immutable native jumper route without modeling its bridge as wire", () => {
  const params: PostProcessingSolverParams = {
    hdRoutes: [
      {
        connectionName: "JUMPER_ROUTE",
        traceThickness: 0.2,
        viaDiameter: 0,
        route: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0, insideJumperPad: true },
          { x: 3, y: 0, z: 0, insideJumperPad: true },
          { x: 4, y: 0, z: 0 },
        ],
        vias: [],
        jumpers: [
          {
            route_type: "jumper",
            start: { x: 1, y: 0 },
            end: { x: 3, y: 0 },
            footprint: "0603",
          },
        ],
      },
    ],
    differentialPairs: [],
    obstacles: [],
    bounds: { minX: -1, maxX: 5, minY: -1, maxY: 1 },
    layerCount: 1,
  }
  const snapshot = structuredClone(params.hdRoutes)
  const solver = new PostProcessingSolver(params)
  solver.solve()

  expect(solver.getOutput().hdRoutes).toEqual(snapshot)
  expect(params.hdRoutes).toEqual(snapshot)
  expect(solver.hdRoutePassthroughSolver?.solved).toBe(true)
  expect(solver.differentialPairReroutingSolver).toBeUndefined()
  expect(solver.computeProgress()).toBe(1)
})
