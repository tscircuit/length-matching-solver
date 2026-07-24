import { expect, test } from "bun:test"
import { DifferentialPairPostProcessingSolver } from "../../lib"
import { getDifferentialPairTestParams } from "./getDifferentialPairTestParams"

test("replaces a straight pair with deterministic coupled geometry", () => {
  const solver = new DifferentialPairPostProcessingSolver(
    getDifferentialPairTestParams(),
  )
  const repeatedSolver = new DifferentialPairPostProcessingSolver(
    getDifferentialPairTestParams(),
  )

  solver.solve()
  repeatedSolver.solve()

  const output = solver.getOutput()
  expect(output).toEqual(repeatedSolver.getOutput())
  const pairResult = output.pairResults[0]
  expect(pairResult?.status).toBe("routed")
  if (pairResult?.status !== "routed") {
    throw new Error("Expected the straight differential pair to route")
  }
  expect(
    Math.abs(
      pairResult.positivePcbTrace.trace_length! -
        pairResult.negativePcbTrace.trace_length!,
    ),
  ).toBeLessThanOrEqual(0.01)
})
