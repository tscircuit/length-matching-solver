import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("renders a non-empty post-processing debug view", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver({
    ...params,
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 5, y: 4 },
        width: 1,
        height: 0.5,
        connectedTo: [],
      },
    ],
  })
  let graphics = solver.visualize()
  for (let index = 0; index < 10; index++) {
    solver.step()
    graphics = solver.visualize()
    if (graphics.lines?.some((line) => line.strokeColor === "#16a34a")) break
  }
  expect(graphics.lines?.some((line) => line.strokeColor === "#16a34a")).toBe(
    true,
  )
  expect(graphics).toMatchGraphicsSvg(import.meta.path)
})
