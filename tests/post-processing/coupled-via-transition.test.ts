import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("emits corresponding transitions and equal via counts for both members", () => {
  const makeRoute = (connectionName: string, y: number): HighDensityRoute => ({
    connectionName,
    traceThickness: 0.2,
    viaDiameter: 0.5,
    route: [
      { x: 0, y, z: 0 },
      { x: 5, y, z: 0 },
      { x: 5, y, z: 1 },
      { x: 10, y, z: 1 },
    ],
    vias: [{ x: 5, y, zLayers: [0, 1] }],
  })
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver({
    ...params,
    hdRoutes: [makeRoute("P", 0.5), makeRoute("N", -0.5)],
  })
  solver.solve()
  const { hdRoutes } = solver.getOutput()
  const transitions = hdRoutes.map((hdRoute) =>
    hdRoute.route.flatMap((point, index) => {
      const next = hdRoute.route[index + 1]
      return next && next.z !== point.z ? [`${point.z}/${next.z}`] : []
    }),
  )
  const vias = hdRoutes.map((hdRoute) => hdRoute.vias)

  expect(vias[0]!.length).toBeGreaterThan(0)
  expect(vias[0]!.length).toBe(vias[1]!.length)
  expect(transitions[0]).toEqual(transitions[1])
  expect(hdRoutes.every((hdRoute) => hdRoute.viaDiameter === 0.5)).toBe(true)
  for (let routeIndex = 0; routeIndex < hdRoutes.length; routeIndex++) {
    expect(vias[routeIndex]).toHaveLength(transitions[routeIndex]!.length)
    for (const via of vias[routeIndex]!) {
      expect(via.zLayers).toEqual([0, 1])
      expect(
        hdRoutes[routeIndex]!.route.some((point, pointIndex, route) => {
          const next = route[pointIndex + 1]
          return (
            next !== undefined &&
            next.z !== point.z &&
            point.x === via.x &&
            point.y === via.y &&
            next.x === via.x &&
            next.y === via.y
          )
        }),
      ).toBe(true)
    }
  }
  for (let index = 0; index < vias[0]!.length; index++) {
    expect(
      Math.hypot(
        vias[0]![index]!.x - vias[1]![index]!.x,
        vias[0]![index]!.y - vias[1]![index]!.y,
      ),
    ).toBeGreaterThan(0.5)
  }
})
