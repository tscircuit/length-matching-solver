import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("improves a far-apart same-layer pair toward preferred edge spacing", () => {
  const solver = new PostProcessingSolver(createPostProcessingTestParams())
  solver.solve()
  const output = solver.getOutput()
  expect(output.errors).toHaveLength(0)
  const firstInterior = output.traces[0]!.route[1]!
  const secondInterior = output.traces[1]!.route[1]!
  if (firstInterior.route_type !== "wire" || secondInterior.route_type !== "wire")
    throw new Error("Expected interior wire stations")
  const centerDistance = Math.hypot(firstInterior.x - secondInterior.x, firstInterior.y - secondInterior.y)
  const edgeGap = centerDistance - (firstInterior.width + secondInterior.width) / 2
  expect(edgeGap).toBeGreaterThanOrEqual(0.5)
  expect(edgeGap).toBeLessThanOrEqual(1.000001)
})
