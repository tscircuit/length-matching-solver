import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"
import { getMinimumSegmentDistance } from "../../lib/route-geometry"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("processes declared pairs sequentially while retaining all route identities", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const shifted = params.hdRoutes.map(
    (hdRoute): HighDensityRoute => ({
      ...structuredClone(hdRoute),
      connectionName: `${hdRoute.connectionName}2`,
      route: hdRoute.route.map((point) => ({ ...point, y: point.y + 7 })),
    }),
  )
  const solver = new PostProcessingSolver({
    ...params,
    hdRoutes: [...params.hdRoutes, ...shifted],
    differentialPairs: [
      { connectionNames: ["P", "N"], lengthTolerance: 0.01 },
      { connectionNames: ["P2", "N2"], lengthTolerance: 0.01 },
    ],
    bounds: { minX: -2, maxX: 12, minY: -5, maxY: 12 },
  })
  solver.solve()
  const { hdRoutes } = solver.getOutput()
  expect(hdRoutes.map((hdRoute) => hdRoute.connectionName)).toEqual([
    "P",
    "N",
    "P2",
    "N2",
  ])
  expect(hdRoutes.every((hdRoute) => hdRoute.route.length > 2)).toBe(true)
  for (const earlier of hdRoutes.slice(0, 2)) {
    for (const later of hdRoutes.slice(2)) {
      for (
        let firstIndex = 0;
        firstIndex < earlier.route.length - 1;
        firstIndex++
      ) {
        const firstStart = earlier.route[firstIndex]
        const firstEnd = earlier.route[firstIndex + 1]
        if (!firstStart || !firstEnd || firstStart.z !== firstEnd.z) continue
        for (
          let secondIndex = 0;
          secondIndex < later.route.length - 1;
          secondIndex++
        ) {
          const secondStart = later.route[secondIndex]
          const secondEnd = later.route[secondIndex + 1]
          if (
            !secondStart ||
            !secondEnd ||
            secondStart.z !== secondEnd.z ||
            firstStart.z !== secondStart.z
          )
            continue
          const firstWidth = firstStart.traceThickness ?? earlier.traceThickness
          const secondWidth = secondStart.traceThickness ?? later.traceThickness
          const required =
            firstWidth / 2 + secondWidth / 2 + Math.max(firstWidth, secondWidth)
          expect(
            getMinimumSegmentDistance(
              firstStart,
              firstEnd,
              secondStart,
              secondEnd,
            ),
          ).toBeGreaterThanOrEqual(required - 1e-7)
        }
      }
    }
  }
})
