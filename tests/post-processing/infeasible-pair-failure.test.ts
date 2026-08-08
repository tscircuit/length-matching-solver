import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("skips an infeasible pair and returns later improvements", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const laterRoutes = params.hdRoutes.map(
    (hdRoute): HighDensityRoute => ({
      ...structuredClone(hdRoute),
      connectionName: `${hdRoute.connectionName}_LATER`,
      route: hdRoute.route.map((point) => ({ ...point, y: point.y + 10 })),
    }),
  )
  const solver = new PostProcessingSolver({
    ...params,
    hdRoutes: [...params.hdRoutes, ...laterRoutes],
    differentialPairs: [
      { connectionNames: ["P", "N"], lengthTolerance: 0.01 },
      {
        connectionNames: ["P_LATER", "N_LATER"],
        lengthTolerance: 0.01,
      },
    ],
    bounds: { minX: -2, maxX: 12, minY: -5, maxY: 15 },
    obstacles: [
      {
        type: "rect",
        layers: ["top", "bottom"],
        center: { x: 5, y: 0 },
        width: 12,
        height: 9,
        connectedTo: [],
      },
    ],
  })

  solver.solve()
  const output = solver.getOutput()

  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  expect(solver.differentialPairReroutingSolver?.failed).toBe(false)
  expect(solver.differentialPairReroutingSolver?.stats).toMatchObject({
    acceptedPairCount: 1,
    skippedPairCount: 1,
  })
  expect(output.hdRoutes.slice(0, 2)).toEqual(params.hdRoutes)
  expect(
    output.hdRoutes.slice(2).every((route) => route.route.length > 2),
  ).toBe(true)
  expect(output.postProcessingErrors).toEqual([
    {
      type: "post_processing_error",
      stage: "differentialPairReroutingSolver",
      message:
        "PostProcessingSolver: differential pair P/N could not be improved without violating bounds, copper clearance, or coupled-via constraints",
      connectionNames: ["P", "N"],
      reason: "no-valid-candidate",
      returnedRouteSource: "best-effort-hd-routes",
    },
  ])
})
