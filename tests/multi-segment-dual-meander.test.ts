import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../lib"
import { getRouteLength } from "../lib/route-geometry"
import type { HighDensityRoute } from "../lib/types"

test("combines one longer-route meander with multiple shorter-route meanders", () => {
  const longerRoute: HighDensityRoute = {
    connectionName: "multi_dual_p",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    route: [0, 12].map((x) => ({ x, y: 0.25, z: 0 })),
    vias: [],
  }
  const shorterRoute: HighDensityRoute = {
    connectionName: "multi_dual_n",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    route: [0, 6, 11.6].map((x) => ({ x, y: -0.25, z: 0 })),
    vias: [],
  }
  const solver = new LengthMatchingSolver({
    hdRoutes: [longerRoute, shorterRoute],
    originalConnections: [
      {
        name: "multi_dual_p",
        pointsToConnect: [
          { x: 0, y: 0.25, layer: "top" },
          { x: 12, y: 0.25, layer: "top" },
        ],
      },
      {
        name: "multi_dual_n",
        pointsToConnect: [
          { x: 0, y: -0.25, layer: "top" },
          { x: 11.6, y: -0.25, layer: "top" },
        ],
      },
    ],
    differentialPairs: [
      {
        connectionNames: ["multi_dual_p", "multi_dual_n"],
        lengthTolerance: 0.01,
      },
    ],
    maximumMeanderDepth: 0.6,
    maxToothCount: 1,
    bounds: { minX: -1, maxX: 13, minY: -2, maxY: 2 },
    layerCount: 2,
  })

  solver.solve()

  const matchedLongerRoute = solver.matchedHdRoutes[0]
  const matchedShorterRoute = solver.matchedHdRoutes[1]
  if (!matchedLongerRoute || !matchedShorterRoute)
    throw new Error("Expected both multi-segment dual routes")
  const longerAddedLength =
    getRouteLength(matchedLongerRoute) - getRouteLength(longerRoute)
  const shorterAddedLength =
    getRouteLength(matchedShorterRoute) - getRouteLength(shorterRoute)
  expect(solver.solved).toBe(true)
  expect(longerAddedLength).toBeGreaterThan(0.7)
  expect(longerAddedLength).toBeLessThan(0.75)
  expect(shorterAddedLength).toBeGreaterThan(1)
    expect(
      Math.abs(
        getRouteLength(matchedLongerRoute) - getRouteLength(matchedShorterRoute),
      ),
  ).toBeLessThanOrEqual(0.01)
})
