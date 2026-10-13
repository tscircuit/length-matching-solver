import { expect, test } from "bun:test"
import { distance } from "@tscircuit/math-utils"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"

test("length matches adjacent differential segments sharing logical roots", () => {
  const hdRoutes: HighDensityRoute[] = [
    {
      connectionName: "b",
      rootConnectionName: "positive",
      traceThickness: 0.15,
      viaDiameter: 0.3,
      vias: [],
      route: [
        {
          x: 0,
          y: 3,
          z: 0,
        },
        {
          x: 6,
          y: 3,
          z: 0,
        },
        {
          x: 8,
          y: 1,
          z: 0,
        },
      ],
    },
    {
      connectionName: "a",
      rootConnectionName: "positive",
      traceThickness: 0.15,
      viaDiameter: 0.3,
      vias: [],
      route: [
        {
          x: -8,
          y: 1,
          z: 0,
        },
        {
          x: -2,
          y: 1,
          z: 0,
        },
        {
          x: 0,
          y: 3,
          z: 0,
        },
      ],
    },
    {
      connectionName: "d",
      rootConnectionName: "negative",
      traceThickness: 0.15,
      viaDiameter: 0.3,
      vias: [],
      route: [
        {
          x: 0,
          y: -1,
          z: 0,
        },
        {
          x: 8,
          y: -1,
          z: 0,
        },
      ],
    },
    {
      connectionName: "c",
      rootConnectionName: "negative",
      traceThickness: 0.15,
      viaDiameter: 0.3,
      vias: [],
      route: [
        {
          x: -8,
          y: -1,
          z: 0,
        },
        {
          x: 0,
          y: -1,
          z: 0,
        },
      ],
    },
  ]
  const solver = new PostProcessingSolver({
    hdRoutes,
    differentialPairs: [
      { connectionNames: ["a", "c"], lengthTolerance: 0.075 },
      { connectionNames: ["b", "d"], lengthTolerance: 0.075 },
    ],
    bounds: { minX: -12, maxX: 12, minY: -6, maxY: 6 },
    minTraceToPadEdgeClearance: 0.15,
    obstacles: [],
    layerCount: 2,
  })
  solver.solve()
  expect(solver.failed).toBe(false)
  const output = solver.getOutput()
  expect(output.hdRoutes).toHaveLength(4)
  for (const input of hdRoutes) {
    const route = output.hdRoutes.find(
      (route) => route.connectionName === input.connectionName,
    )!
    expect(route.rootConnectionName).toBe(input.rootConnectionName)
    expect(route.route[0]).toMatchObject(input.route[0]!)
    expect(route.route.at(-1)).toMatchObject(input.route.at(-1)!)
  }
  const lengths = output.hdRoutes.map((route) =>
    route.route
      .slice(1)
      .reduce(
        (total, point, index) => total + distance(point, route.route[index]!),
        0,
      ),
  )
  expect(Math.abs(lengths[0]! - lengths[2]!)).toBeLessThanOrEqual(0.075)
  expect(Math.abs(lengths[1]! - lengths[3]!)).toBeLessThanOrEqual(0.075)
  expect(lengths[2]! + lengths[3]!).toBeGreaterThan(16)
})
