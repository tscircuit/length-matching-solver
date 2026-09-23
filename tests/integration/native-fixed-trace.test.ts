import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../../lib"
import type { ConnectionPoint, HighDensityRoute, SimpleRouteConnection, SimplifiedPcbTrace } from "../../lib/types"
import { getMinimumSegmentDistance, getRouteLength } from "../../lib/route-geometry"

test("matches around native fixed copper without counting it toward logical lengths", (): void => {
  const hdRoutes: HighDensityRoute[] = [10, 12].map((length, index): HighDensityRoute => ({
    connectionName: index === 0 ? "a" : "b",
    traceThickness: 0.15, viaDiameter: 0.6, vias: [],
    route: [{ x: 0, y: index * 3, z: 0 }, { x: length, y: index * 3, z: 0 }],
  }))
  const trace: SimplifiedPcbTrace = {
    type: "pcb_trace", pcb_trace_id: "fixed", connection_name: "a",
    route: [
      { route_type: "wire", x: 1, y: 0.3, layer: "top", width: 0.15 },
      { route_type: "wire", x: 9, y: 0.3, layer: "top", width: 0.15 },
    ],
  }
  const before = structuredClone(trace)
  const solver = new LengthMatchingSolver({
    hdRoutes, traces: [trace],
    originalConnections: hdRoutes.map((route): SimpleRouteConnection => ({
      name: route.connectionName,
      pointsToConnect: route.route.map((point): ConnectionPoint => ({ x: point.x, y: point.y, layer: "top" })),
    })),
    differentialPairs: [{ connectionNames: ["a", "b"], lengthTolerance: 0.1 }],
    layerCount: 2, obstacleMargin: 0.15,
  })
  solver.solve()
  const { matchedHdRoutes } = solver.getOutput()
  expect(matchedHdRoutes).toHaveLength(2)
  expect(trace).toEqual(before)
  expect(Math.abs(getRouteLength(matchedHdRoutes[0]!) - getRouteLength(matchedHdRoutes[1]!))).toBeLessThanOrEqual(0.1)
  for (const route of matchedHdRoutes) {
    for (let index = 1; index < route.route.length; index++) {
      expect(getMinimumSegmentDistance(route.route[index - 1]!, route.route[index]!, { x: 1, y: 0.3 }, { x: 9, y: 0.3 })).toBeGreaterThanOrEqual(0.3 - 1e-8)
    }
  }
})
