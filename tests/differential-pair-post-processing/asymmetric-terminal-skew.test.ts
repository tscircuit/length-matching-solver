import { expect, test } from "bun:test"
import { DifferentialPairPostProcessingSolver } from "../../lib"
import { getDifferentialPairTestParams } from "./getDifferentialPairTestParams"

test("corrects skew introduced by asymmetric terminal escape geometry", () => {
  const params = getDifferentialPairTestParams({
    obstacles: [
      {
        obstacle_id: "near_start_keepout",
        type: "rect",
        layers: ["top"],
        center: { x: -3.5, y: 0 },
        width: 1,
        height: 2,
      },
    ],
  })
  const positiveStart = params.pcbTraces[0]!.route[0]
  const negativeStart = params.pcbTraces[1]!.route[0]
  if (
    positiveStart?.route_type !== "wire" ||
    negativeStart?.route_type !== "wire"
  ) {
    throw new Error("Expected wire terminals in the test fixture")
  }
  positiveStart.y = 0.4
  negativeStart.y = -0.4
  params.differentialPairs[0]!.maxLengthSkew = 0.001
  const solver = new DifferentialPairPostProcessingSolver(params)

  solver.solve()

  const pairResult = solver.getOutput().pairResults[0]
  expect(pairResult?.status).toBe("routed")
  if (pairResult?.status !== "routed") {
    throw new Error(
      `Expected terminal skew correction, received ${pairResult?.failure.category}`,
    )
  }
  expect(
    Math.abs(
      pairResult.positivePcbTrace.trace_length! -
        pairResult.negativePcbTrace.trace_length!,
    ),
  ).toBeLessThanOrEqual(0.001)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
