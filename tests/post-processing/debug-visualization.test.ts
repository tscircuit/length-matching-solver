import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("renders a non-empty post-processing debug view", () => {
  const solver = new PostProcessingSolver(createPostProcessingTestParams({
    obstacles: [{ type: "rect", layers: ["top"], center: { x: 5, y: 4 }, width: 1, height: 0.5, connectedTo: [] }],
  }))
  solver.step()
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
