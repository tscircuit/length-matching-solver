import { expect, test } from "bun:test"
import { DifferentialPairPostProcessingSolver } from "../../lib"
import { getDifferentialPairTestParams } from "./getDifferentialPairTestParams"

test("changes layers only through a paired via transition", () => {
  const solver = new DifferentialPairPostProcessingSolver(
    getDifferentialPairTestParams({
      positiveEndLayer: "bottom",
      negativeEndLayer: "bottom",
    }),
  )

  solver.solve()

  const pairResult = solver.getOutput().pairResults[0]
  expect(pairResult?.status).toBe("routed")
  if (pairResult?.status !== "routed") {
    throw new Error("Expected the pair to route through paired vias")
  }
  expect(pairResult.pcbVias).toHaveLength(2)
  expect(
    pairResult.positivePcbTrace.route.filter(
      (routePoint) => routePoint.route_type === "via",
    ),
  ).toHaveLength(1)
  expect(
    pairResult.negativePcbTrace.route.filter(
      (routePoint) => routePoint.route_type === "via",
    ),
  ).toHaveLength(1)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
