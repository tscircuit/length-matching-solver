import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-03/sample-03.srj.json"
import { AlertingLengthMatchingSolver } from "../fixtures/alerting-length-matching-solver"
import type { LengthMatchingSolverParams } from "../lib"

test("reports an unsolved fixture through the browser alert and failed state", () => {
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

    expect(solver.failed).toBe(true)
    expect(solver.solved).toBe(false)
    expect(alertMessage).toContain("linear regression exhausted")
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    })
  }
})
