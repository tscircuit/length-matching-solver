import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-01/sample-01.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../../lib"

test("rejects an invalid caller-provided visualization color", () => {
  // SAFETY: This repository-owned JSON fixture is known to satisfy the solver input contract.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver({
    ...params,
    colorMap: { data_n: "not-a-color" },
  })

  solver.solve()
  expect(() => solver.visualize()).toThrow()
})
