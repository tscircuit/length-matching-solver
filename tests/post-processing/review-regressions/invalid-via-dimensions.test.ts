import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("returns input routes for invalid native via diameters", () => {
  for (const viaDiameter of [0, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const { simpleRouteJson: _fixture, ...params } =
      createPostProcessingTestParams()
    const hdRoutes = structuredClone(params.hdRoutes)
    hdRoutes[0]!.viaDiameter = viaDiameter
    const output = new PostProcessingSolver({ ...params, hdRoutes }).getOutput()

    expect(output.hdRoutes).toEqual(hdRoutes)
    expect(output.postProcessingErrors).toEqual([
      expect.objectContaining({
        stage: "validation",
        message: expect.stringMatching(/HD route declaration is invalid/),
        returnedRouteSource: "input-hd-routes",
      }),
    ])
  }
})
