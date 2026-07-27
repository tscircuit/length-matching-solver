import { expect, test } from "bun:test"
import { PostProcessingSolver, type PostProcessingGridConfig } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("rejects invalid optional composite routing-grid configuration", () => {
  const invalidConfigurations: PostProcessingGridConfig[] = [
    { innerGridStep: 0 },
    { innerGridStep: 0.00001 },
    { innerGridStep: 0.5, outerGridStep: 0.5 },
    { outerGridStep: Number.POSITIVE_INFINITY },
    { outerPerimeterWidth: 5 },
  ]
  for (const routingGrid of invalidConfigurations)
    expect(() => new PostProcessingSolver(
      createPostProcessingTestParams({ routingGrid }),
    )).toThrow(/PostProcessingSolver: routingGrid/)
})
