import { expect, test } from "bun:test"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"
import { DifferentialPairRoutingSession } from "../../../lib/post-processing/routing/DifferentialPairRoutingSession"

test("moves the coupled run past an obstacle between side-by-side start pads", () => {
  const { simpleRouteJson } = createPostProcessingTestParams()
  const solver = new DifferentialPairRoutingSession({
    ...simpleRouteJson,
    obstacles: [
      {
        type: "rect",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1.6,
        layers: ["top"],
        connectedTo: [],
      },
    ],
    pair: {
      connectionNames: ["P", "N"],
      lengthTolerance: 0.1,
      minimumCenterlineDistance: 0.3,
      maximumCenterlineDistance: 0.3,
    },
  })

  let progress = solver.getProgress()
  while (!solver.isComplete()) {
    solver.step()
    const nextProgress = solver.getProgress()
    expect(nextProgress).toBeGreaterThanOrEqual(progress)
    progress = nextProgress
  }
  const result = solver.getResult()

  if (result.status !== "accepted") throw new Error("Expected a rerouted pair")
  expect(result.candidate.centerlineDistance).toBeCloseTo(0.3, 8)
  const firstCoupledPoint = result.candidate.first.route[1]
  if (firstCoupledPoint?.route_type !== "wire")
    throw new Error("Expected the first coupled point to be wire geometry")
  expect(firstCoupledPoint.x).toBeGreaterThan(0.5)
})
