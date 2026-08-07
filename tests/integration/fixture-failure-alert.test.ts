import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-03/sample-03.srj.json"
import { AlertingLengthMatchingSolver } from "../../fixtures/alerting-length-matching-solver"
import type { LengthMatchingSolverParams } from "../../lib"

test("reports an unsolved fixture through structured output", () => {
  const originalWindow = globalThis.window
  let alertMessage = ""
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { alert: (message: string): void => void (alertMessage = message) },
  })

  try {
    // SAFETY: This repository-owned JSON is the sample fixture input. The cast restores literal tuple and obstacle discriminants widened by JSON module inference.
    const params = {
      ...(sampleProblem as unknown as LengthMatchingSolverParams),
      maximumMeanderDepth: 0.1,
      maxToothCount: 1,
    }
    const solver = new AlertingLengthMatchingSolver(params)
    solver.solve()

    expect(solver.failed).toBe(false)
    expect(solver.solved).toBe(true)
    expect(alertMessage).toBe("")
    expect(solver.getOutput().errors[0]?.message).toContain(
      "linear regression exhausted",
    )
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    })
  }
})
