import { expect, test } from "bun:test"
import { DifferentialPairPostProcessingSolver } from "../../lib"
import { getDifferentialPairTestParams } from "./getDifferentialPairTestParams"

test("produces identical output when obstacle input order changes", () => {
  const obstacles = [
    {
      obstacle_id: "upper_keepout",
      type: "rect" as const,
      layers: ["top"],
      center: { x: 0, y: 2.5 },
      width: 1,
      height: 1,
    },
    {
      obstacle_id: "center_keepout",
      type: "rect" as const,
      layers: ["top"],
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
    },
  ]
  const firstSolver = new DifferentialPairPostProcessingSolver(
    getDifferentialPairTestParams({ obstacles }),
  )
  const secondSolver = new DifferentialPairPostProcessingSolver(
    getDifferentialPairTestParams({
      obstacles: obstacles.slice().reverse(),
    }),
  )

  firstSolver.solve()
  secondSolver.solve()

  expect(secondSolver.getOutput()).toEqual(firstSolver.getOutput())
})
