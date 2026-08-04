import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type HighDensityRoute,
} from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("returns the input routes when a pair cannot be rerouted", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const laterRoutes = params.hdRoutes.map(
    (hdRoute): HighDensityRoute => ({
      ...structuredClone(hdRoute),
      connectionName: `${hdRoute.connectionName}_LATER`,
      route: hdRoute.route.map((point) => ({ ...point, y: point.y + 10 })),
    }),
  )
  const hdRoutes = [...params.hdRoutes, ...laterRoutes]
  const solver = new PostProcessingSolver({
    ...params,
    hdRoutes,
    differentialPairs: [
      { connectionNames: ["P", "N"], lengthTolerance: 0.01 },
      {
        connectionNames: ["P_LATER", "N_LATER"],
        lengthTolerance: 0.01,
      },
    ],
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

  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  expect(solver.differentialPairReroutingSolver?.failed).toBe(true)
  expect(
    solver.differentialPairReroutingSolver?.computeProgress(),
  ).toBeLessThan(0.5)
  expect(solver.differentialPairReroutingSolver?.stats.pair).toBe("P/N")
  expect(solver.fortyFiveDegreeSimplificationSolver).toBeUndefined()
  expect(solver.lengthMatchingSolver).toBeUndefined()
  expect(solver.hdRouteReconstructionSolver).toBeUndefined()
  expect(output.hdRoutes).toEqual(hdRoutes)
  expect(output.nonIdealRouteIssues).toEqual([
    expect.objectContaining({
      type: "post_processing_error",
      stage: "differentialPairReroutingSolver",
      returnedRouteSource: "input-hd-routes",
    }),
  ])
})
