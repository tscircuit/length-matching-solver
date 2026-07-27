import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("rejects a connection declared in more than one differential pair", () => {
  const params = createPostProcessingTestParams()
  expect(
    () =>
      new PostProcessingSolver({
        ...params,
        differentialPairs: [
          { connectionNames: ["P", "N"], lengthTolerance: 0.01 },
          { connectionNames: ["N", "OTHER"], lengthTolerance: 0.01 },
        ],
      }),
  ).toThrow(/connection "N" belongs to multiple differential pairs/)
})
