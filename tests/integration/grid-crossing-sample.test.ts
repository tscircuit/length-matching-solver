import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-13/sample-13.srj.json"
import { PostProcessingSolver, type PostProcessingSolverParams } from "../../lib"

test("grid crossing post-processing input crosses the blocker on bottom", () => {
  const params = sampleProblem as unknown as PostProcessingSolverParams
  const solver = new PostProcessingSolver(params)

  solver.solve()

  const output = solver.getOutput()
  expect(solver.solved).toBe(true)
  expect(output.errors).toHaveLength(0)
  expect(output.traces.map((trace) => trace.connection_name)).toEqual([
    "grid_upper",
    "grid_lower",
    "grid_vertical",
  ])
  const reroutedPair = output.traces.slice(0, 2)
  expect(reroutedPair.map((trace) =>
    trace.route.filter((entry) => entry.route_type === "via").length,
  )).toEqual([2, 2])
  expect(reroutedPair.flatMap((trace) => trace.route)
    .some((entry) => entry.route_type === "wire" && entry.layer === "bottom")).toBe(true)
  expect(output.traces[2]).toEqual(params.traces[2])
  expect(solver.visualize()).toBeTruthy()
})
