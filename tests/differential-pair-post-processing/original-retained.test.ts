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
  expect(String(pairResult.differentialPairName)).toBe("USB")
  expect(pairResult.failure.category).toBe("spacing_bounds_unsatisfiable")
  expect(pairResult.failure.message).toBe(
    "effective minimum centerline spacing 0.6 exceeds maximum 0.4",
  )
  expect(String(pairResult.failure.positiveSourceTraceId)).toBe(
    "source_trace_positive",
  )
  expect(String(pairResult.failure.negativeSourceTraceId)).toBe(
    "source_trace_negative",
  )
  expect(params.pcbTraces).toEqual(originalPcbTraces)
})
