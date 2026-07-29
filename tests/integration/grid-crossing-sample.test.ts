import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-13/sample-13.srj.json"
import {
  type CompleteSimpleRouteJson,
  PostProcessingSolver,
} from "../../lib"

test("grid crossing post-processing input crosses the blocker on bottom", () => {
  const simpleRouteJson =
    sampleProblem as unknown as CompleteSimpleRouteJson
  const solver = new PostProcessingSolver({ simpleRouteJson })

  solver.solve()

  const output = solver.getOutput()
  expect(solver.solved).toBe(true)
  expect(
    output.simpleRouteJson.traces.map((trace) => trace.connection_name),
  ).toEqual([
    "grid_upper",
    "grid_lower",
    "grid_vertical",
  ])
  const reroutedPair = output.simpleRouteJson.traces.slice(0, 2)
  expect(
    reroutedPair.map(
      (trace) =>
        trace.route.filter((entry) => entry.route_type === "via").length,
    ),
  ).toEqual([2, 2])
  expect(
    reroutedPair
      .flatMap((trace) => trace.route)
      .some((entry) => entry.route_type === "wire" && entry.layer === "bottom"),
  ).toBe(true)
  expect(output.simpleRouteJson.traces[2]).toEqual(simpleRouteJson.traces[2])
  expect(solver.visualize()).toBeTruthy()
})
