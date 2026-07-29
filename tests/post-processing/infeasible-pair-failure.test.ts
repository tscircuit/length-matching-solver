import { expect, test } from "bun:test"
import {
  DifferentialPairRoutingError,
  PostProcessingSolver,
  type HighDensityRoute,
} from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("throws a pair-specific error and stops before processing the next pair", () => {
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

  let thrown: unknown
  try {
    solver.solve()
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(DifferentialPairRoutingError)
  if (!(thrown instanceof DifferentialPairRoutingError)) throw thrown
  expect(thrown.name).toBe("DifferentialPairRoutingError")
  expect(thrown.connectionNames).toEqual(["P", "N"])
  expect(thrown.reason).toBe("no-valid-candidate")
  expect(solver.failed).toBe(true)
  expect(solver.solved).toBe(false)
  expect(solver.differentialPairReroutingSolver?.failed).toBe(true)
  expect(
    solver.differentialPairReroutingSolver?.computeProgress(),
  ).toBeLessThan(0.5)
  expect(solver.differentialPairReroutingSolver?.stats.pair).toBe("P/N")
  expect(solver.fortyFiveDegreeSimplificationSolver).toBeUndefined()
  expect(solver.lengthMatchingSolver).toBeUndefined()
  expect(solver.hdRouteReconstructionSolver).toBeUndefined()
  expect(() => solver.getOutput()).toThrow(/before the solver completed/)
})
