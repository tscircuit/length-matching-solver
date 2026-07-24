import { expect, test } from "bun:test"
import {
  DifferentialPairInputError,
  DifferentialPairPostProcessingSolver,
} from "../../lib"
import { getDifferentialPairTestParams } from "./getDifferentialPairTestParams"

test("rejects a final terminal gap greater than the maximum pair spacing", () => {
  const params = getDifferentialPairTestParams()
  const negativeEnd = params.pcbTraces[1]!.route.at(-1)
  if (negativeEnd?.route_type !== "wire") {
    throw new Error("Expected a wire endpoint in the test fixture")
  }
  negativeEnd.y = -0.5
  const solver = new DifferentialPairPostProcessingSolver(params)

  expect(() => solver.solve()).toThrow(
    new DifferentialPairInputError(
      "invalid_state",
      'DifferentialPairPostProcessingSolver: differential pair "USB" has final terminal gap 0.65 exceeding maximum centerline spacing 0.4',
    ),
  )
})
