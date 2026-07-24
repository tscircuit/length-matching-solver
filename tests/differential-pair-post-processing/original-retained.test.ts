import { expect, test } from "bun:test"
import { DifferentialPairPostProcessingSolver } from "../../lib"
import { getDifferentialPairTestParams } from "./getDifferentialPairTestParams"

test("retains both originals when spacing and DRC are unsatisfiable", () => {
  const params = getDifferentialPairTestParams()
  params.designRules.traceToTraceClearance = 0.5
  const originalPcbTraces = structuredClone(params.pcbTraces)
  const solver = new DifferentialPairPostProcessingSolver(params)

  solver.solve()

  const pairResult = solver.getOutput().pairResults[0]
  expect(pairResult?.status).toBe("original_retained")
  if (pairResult?.status !== "original_retained") {
    throw new Error("Expected the unsatisfiable pair to be retained")
  }
  expect(pairResult.failure.category).toBe(
    "spacing_bounds_unsatisfiable",
  )
  expect(params.pcbTraces).toEqual(originalPcbTraces)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
