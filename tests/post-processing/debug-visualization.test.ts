import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("renders a non-empty post-processing debug view", () => {
  const solver = new PostProcessingSolver(createPostProcessingTestParams({
    obstacles: [{ type: "rect", layers: ["top"], center: { x: 5, y: 4 }, width: 1, height: 0.5, connectedTo: [] }],
  }))
  for (let index = 0; index < 4; index++) solver.step()
  const graphics = solver.visualize()
  expect(graphics.lines?.some((line) => line.strokeColor === "#16a34a")).toBe(true)
  expect(graphics).toMatchGraphicsSvg(import.meta.path)
})
