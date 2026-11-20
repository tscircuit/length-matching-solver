import { expect, test } from "bun:test"
import { DifferentialPairRoutingSession } from "../../../lib/post-processing/routing/DifferentialPairRoutingSession"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("reports zero progress when no fanout fits the uncoupled length limit", () => {
  const { simpleRouteJson } = createPostProcessingTestParams()
  const session = new DifferentialPairRoutingSession({
    ...simpleRouteJson,
    pair: { ...simpleRouteJson.differentialPairs[0]!, maxUncoupledLength: 0.1 },
  })
  expect(session.getStats().attemptCount).toBe(0)
  expect(session.getProgress()).toBe(0)
  expect(() => session.step()).toThrow("could not be improved")
})
