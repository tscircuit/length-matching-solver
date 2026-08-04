import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns input routes when a post-processing stage fails", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const inputRoutes = structuredClone(params.hdRoutes)
  const solver = new PostProcessingSolver({
    ...params,
    obstacles: [
      {
        type: "rect",
        layers: ["top", "bottom"],
        center: { x: 5, y: 0 },
        width: 8,
        height: 9,
        connectedTo: [],
      },
    ],
  })

  solver.solve()
  const output = solver.getOutput()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(output.hdRoutes).toEqual(inputRoutes)
  expect(output.nonIdealRouteIssues).toHaveLength(1)
  expect(output.nonIdealRouteIssues?.[0]).toMatchObject({
    type: "post_processing_error",
    stage: "differentialPairReroutingSolver",
    returnedRouteSource: "input-hd-routes",
  })
})
