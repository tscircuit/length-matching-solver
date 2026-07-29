import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

const measure = (trace: SimplifiedPcbTrace): number => {
  let total = 0
  let previous: Extract<
    SimplifiedPcbTrace["route"][number],
    { route_type: "wire" }
  > | null = null
  for (const entry of trace.route) {
    if (entry.route_type === "via") {
      previous = null
      continue
    }
    if (entry.route_type !== "wire") continue
    if (previous && previous.layer === entry.layer)
      total += Math.hypot(entry.x - previous.x, entry.y - previous.y)
    previous = entry
  }
  return total
}

test("applies final geometry-checked matching within declared length tolerance", () => {
  const params = createPostProcessingTestParams()
  const traces = structuredClone(params.simpleRouteJson.traces)
  const last = traces[1]!.route.at(-1)!
  if (last.route_type !== "wire") throw new Error("Expected endpoint wire")
  last.x = 9
  const solver = new PostProcessingSolver({
    ...params,
    simpleRouteJson: { ...params.simpleRouteJson, traces },
  })
  solver.solve()
  const output = solver.getOutput()
  expect(
    Math.abs(
      measure(output.simpleRouteJson.traces[0]!) -
        measure(output.simpleRouteJson.traces[1]!),
    ),
  ).toBeLessThanOrEqual(0.010001)
})
