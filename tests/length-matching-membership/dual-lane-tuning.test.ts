import { expect, test } from "bun:test"
import { LengthMatchingSolver, type HighDensityRoute } from "../../lib"
import { getRouteLength } from "../../lib/route-geometry"

test("dual meanders measure all exact hops while excluding same-root taps", (): void => {
  const hdRoutes: HighDensityRoute[] = [
    { name: "P:0", root: "P_BEFORE", x: 0, y: 0.25, length: 12 },
    { name: "N:0", root: "N_BEFORE", x: 0, y: -0.25, length: 11.6 },
    { name: "P:1", root: "P_AFTER", x: 30, y: 3, length: 2 },
    { name: "N:1", root: "N_AFTER", x: 30, y: -3, length: 2 },
    { name: "P_TAP", root: "P_BEFORE", x: 40, y: 5, length: 10 },
  ].map(({ name, root, x, y, length }): HighDensityRoute => ({
    connectionName: name,
    rootConnectionName: root,
    traceThickness: 0.15,
    viaDiameter: 0.6,
    route: [
      { x, y, z: 0 },
      { x: x + length, y, z: 0 },
    ],
    vias: [],
  }))
  hdRoutes[1]!.route.splice(1, 0, { x: 6, y: -0.25, z: 0 })
  const solver = new LengthMatchingSolver({
    hdRoutes,
    originalConnections: hdRoutes.slice(0, 4).map((route) => ({
      name: route.connectionName,
      pointsToConnect: [route.route[0]!, route.route.at(-1)!].map(({ x, y }) => ({
        x,
        y,
        layer: "top",
      })),
    })),
    differentialPairs: [
      {
        connectionNames: [
          ["P:0", "P:1"],
          ["N:0", "N:1"],
        ],
        maxLengthSkewMm: 0.01,
      },
    ],
    maximumMeanderDepth: 0.6,
    maxToothCount: 1,
    layerCount: 2,
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.stats.mode).toBe("dual-meander")
  const output = solver.getOutput().matchedHdRoutes
  const lengths = output.map(getRouteLength)
  expect(lengths[0]).toBeGreaterThan(12)
  expect(lengths[1]).toBeGreaterThan(11.6)
  expect(
    Math.abs(lengths[0]! + lengths[2]! - lengths[1]! - lengths[3]!),
  ).toBeLessThanOrEqual(0.01)
  expect(output.slice(2)).toEqual(hdRoutes.slice(2))
  expect(output.map((route) => route.rootConnectionName)).toEqual(
    hdRoutes.map((route) => route.rootConnectionName),
  )
})
