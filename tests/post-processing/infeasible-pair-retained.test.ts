import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("retains both original traces and returns one generic Error when infeasible", () => {
  const params = createPostProcessingTestParams({
    obstacles: [
      {
        type: "rect",
        layers: ["top", "bottom"],
        center: { x: 5, y: 0 },
        width: 8,
        height: 9,
        connectedTo: [],
      },
    ],
  })
  const original = structuredClone(params.traces)
  const solver = new PostProcessingSolver(params)
  solver.solve()
  const output = solver.getOutput()
  expect(output.errors).toHaveLength(1)
  expect(output.errors[0]).toBeInstanceOf(Error)
  expect(output.traces).toEqual(original)
})
