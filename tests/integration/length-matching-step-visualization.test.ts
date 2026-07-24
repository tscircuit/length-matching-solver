import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-01/sample-01.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../../lib"

test("renders distinct geometry for pair selection, scoring, and completion", () => {
  // SAFETY: This repository-owned fixture is exercised by the solver regression test. The cast restores JSON literals widened by TypeScript module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const solver = new LengthMatchingSolver(params)

  solver.step()
  expect(solver.visualize().lines).toHaveLength(3)

  solver.step()
  expect(solver.visualize().lines).toHaveLength(4)

  for (let index = 0; index < 100; index++) {
    const matchedRoute = solver.matchedHdRoutes[1]
    if (!matchedRoute)
      throw new Error("Expected the sample fixture to contain a short route")
    if (matchedRoute.route.length > 2) break
    solver.step()
  }
  const matchedRoute = solver.matchedHdRoutes[1]
  if (!matchedRoute)
    throw new Error("Expected the sample fixture to contain a short route")
  expect(matchedRoute.route.length).toBeGreaterThan(2)
  const scoringLines = solver.visualize().lines
  if (!scoringLines)
    throw new Error("Expected scoring visualization lines for the sample route")
  expect(scoringLines.length).toBeGreaterThan(3)

  solver.solve()
  const completedLines = solver.visualize().lines
  if (!completedLines)
    throw new Error(
      "Expected completed visualization lines for the sample route",
    )
  expect(completedLines.length).toBeGreaterThan(3)
})
