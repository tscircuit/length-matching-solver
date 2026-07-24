import { expect, test } from "bun:test"
import { DifferentialPairPostProcessingSolver } from "../../lib"
import { getDifferentialPairTestParams } from "./getDifferentialPairTestParams"

test("routes both pair members together around a blocking obstacle", () => {
  const solver = new DifferentialPairPostProcessingSolver(
    getDifferentialPairTestParams({
      obstacles: [
        {
          obstacle_id: "center_keepout",
          type: "rect",
          layers: ["top"],
          center: { x: 0, y: 0 },
          width: 2,
          height: 2,
        },
      ],
    }),
  )

  solver.solve()

  const pairResult = solver.getOutput().pairResults[0]
  expect(pairResult?.status).toBe("routed")
  if (pairResult?.status !== "routed") {
    throw new Error("Expected the pair to detour around the obstacle")
  }
  expect(pairResult.positivePcbTrace.route.length).toBeGreaterThan(4)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
