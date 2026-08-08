import { expect, test } from "bun:test"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { getRouteLength } from "../lib/route-geometry"

test("matches every routed connection in a maximum-skew group", () => {
  const params: LengthMatchingSolverParams = {
    hdRoutes: [
      {
        connectionName: "DQ0",
        traceThickness: 0.15,
        viaDiameter: 0.45,
        route: [
          { x: 0, y: 4, z: 0 },
          { x: 4, y: 4, z: 0 },
          { x: 4, y: 6, z: 0 },
          { x: 8, y: 6, z: 0 },
          { x: 8, y: 4, z: 0 },
          { x: 12, y: 4, z: 0 },
        ],
        vias: [],
      },
      {
        connectionName: "DQ1",
        traceThickness: 0.15,
        viaDiameter: 0.45,
        route: [
          { x: 0, y: 0, z: 0 },
          { x: 12, y: 0, z: 0 },
        ],
        vias: [],
      },
      {
        connectionName: "DQ2",
        traceThickness: 0.15,
        viaDiameter: 0.45,
        route: [
          { x: 0, y: -4, z: 0 },
          { x: 12, y: -4, z: 0 },
        ],
        vias: [],
      },
    ],
    originalConnections: [
      { name: "DQ0", pointsToConnect: [] },
      { name: "DQ1", pointsToConnect: [] },
      { name: "DQ2", pointsToConnect: [] },
    ].map((connection, index) => ({
      ...connection,
      pointsToConnect: [
        { x: 0, y: 4 - index * 4, layer: "top" },
        { x: 12, y: 4 - index * 4, layer: "top" },
      ],
    })),
    lengthMatchingGroups: [
      {
        connectionNames: ["DQ0", "DQ1", "DQ2"],
        maxLengthSkew: 0.05,
        fixedLengthByConnectionName: { DQ0: 0, DQ1: 1, DQ2: 2 },
      },
    ],
    bounds: { minX: -1, maxX: 13, minY: -9, maxY: 9 },
    layerCount: 2,
  }
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  const lengths = solver.matchedHdRoutes.map(
    (route, index) => getRouteLength(route) + index,
  )
  expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(0.05)
  expect(solver.matchedHdRoutes[1]!.route.length).toBeGreaterThan(2)
  expect(solver.matchedHdRoutes[2]!.route.length).toBeGreaterThan(2)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
