import { expect, test } from "bun:test"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib"
import { getRouteLength } from "../../lib/route-geometry"

test("matches complete lengths while leaving retained copper unchanged", (): void => {
  const params: LengthMatchingSolverParams = {
    hdRoutes: [
      {
        connectionName: "a-carrier",
        rootConnectionName: "a",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        route: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
        vias: [],
      },
      {
        connectionName: "b-carrier",
        rootConnectionName: "b",
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
          { x: 10, y: 0, layer: "top" },
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
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "a-retained",
        connection_name: "a",
        route: [
          { route_type: "wire", x: -1, y: 0, layer: "top", width: 0.1 },
          { route_type: "wire", x: -1, y: -4, layer: "top", width: 0.1 },
          { route_type: "wire", x: 0, y: -4, layer: "top", width: 0.1 },
          { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.1 },
        ],
      },
    ],
    obstacleMargin: 0.1,
    bounds: { minX: -2, maxX: 12, minY: -5, maxY: 16 },
  }
  const originalInput = structuredClone(params)
  const solver = new LengthMatchingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  const [first, second] = solver.getOutput().matchedHdRoutes
  if (!first || !second) throw new Error("Expected both carrier routes")
  expect(first).toEqual(originalInput.hdRoutes[0])
  expect(getRouteLength(second)).toBeGreaterThan(18.99)
  expect(
    Math.abs(getRouteLength(first) + 9 - getRouteLength(second)),
  ).toBeLessThanOrEqual(0.01)
  expect(params).toEqual(originalInput)
  expect(solver.getOutput().matchedHdRoutes).toHaveLength(2)
})
