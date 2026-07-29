import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("fails fast on non-positive or non-finite native via diameters", () => {
  for (const viaDiameter of [0, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const { simpleRouteJson: _fixture, ...params } =
      createPostProcessingTestParams()
    const hdRoutes = structuredClone(params.hdRoutes)
    hdRoutes[0]!.viaDiameter = viaDiameter
    expect(() => new PostProcessingSolver({ ...params, hdRoutes })).toThrow(
      /HD route declaration is invalid/,
    )
  }
})
