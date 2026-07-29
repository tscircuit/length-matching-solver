import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-14/sample-14.srj.json"
import { type HighDensityRoute, PostProcessingSolver } from "../../lib"
import {
  createPostProcessingParamsFromSimpleRouteJson,
  type PostProcessingSimpleRouteJsonFixture,
} from "../../fixtures/createPostProcessingParamsFromSimpleRouteJson"

const getTerminalInteriorAngles = (
  hdRoute: HighDensityRoute,
): [number, number] => {
  const [startTerminal, startCorner, startTrunk] = hdRoute.route
  const [endTrunk, endCorner, endTerminal] = hdRoute.route.slice(-3)
  if (
    !startTerminal ||
    !startCorner ||
    !startTrunk ||
    !endTrunk ||
    !endCorner ||
    !endTerminal
  )
    throw new Error(
      `Expected three route stations for ${hdRoute.connectionName}`,
    )
  const startIncoming = {
    x: startTerminal.x - startCorner.x,
    y: startTerminal.y - startCorner.y,
  }
  const startOutgoing = {
    x: startTrunk.x - startCorner.x,
    y: startTrunk.y - startCorner.y,
  }
  const endIncoming = {
    x: endTerminal.x - endCorner.x,
    y: endTerminal.y - endCorner.y,
  }
  const endOutgoing = {
    x: endTrunk.x - endCorner.x,
    y: endTrunk.y - endCorner.y,
  }
  return [
    (Math.acos(
      (startIncoming.x * startOutgoing.x + startIncoming.y * startOutgoing.y) /
        (Math.hypot(startIncoming.x, startIncoming.y) *
          Math.hypot(startOutgoing.x, startOutgoing.y)),
    ) *
      180) /
      Math.PI,
    (Math.acos(
      (endIncoming.x * endOutgoing.x + endIncoming.y * endOutgoing.y) /
        (Math.hypot(endIncoming.x, endIncoming.y) *
          Math.hypot(endOutgoing.x, endOutgoing.y)),
    ) *
      180) /
      Math.PI,
  ]
}

test("keeps port-selector differential-pair terminal joins at 125 degrees", () => {
  const { routingGrid, ...routeJson } = sampleProblem
  const params = createPostProcessingParamsFromSimpleRouteJson(
    routeJson as unknown as PostProcessingSimpleRouteJsonFixture,
    routingGrid,
  )
  const solver = new PostProcessingSolver(params)
  solver.solve()

  const output = solver.getOutput()
  for (const hdRoute of output.hdRoutes) {
    const [startAngle, endAngle] = getTerminalInteriorAngles(hdRoute)
    expect(startAngle).toBeGreaterThanOrEqual(125)
    expect(endAngle).toBeGreaterThanOrEqual(135)
  }
  const testPointRoute = output.hdRoutes.find(
    (route) => route.connectionName === "source_trace_0",
  )
  if (!testPointRoute) throw new Error("Expected the TP1 source route")
  const lowerTrunk = testPointRoute.route[1]
  const lowerTrunkEnd = testPointRoute.route[2]
  if (!lowerTrunk || !lowerTrunkEnd)
    throw new Error("Expected the TP1 lower trunk")
  expect(testPointRoute.route).toHaveLength(4)
  const matchedRoute = output.hdRoutes.find(
    (route) => route.connectionName === "source_trace_1",
  )
  if (!matchedRoute) throw new Error("Expected the matching source route")
  const centerlineDistances = matchedRoute.route.flatMap((point) =>
    point.x >= lowerTrunk.x && point.x <= lowerTrunkEnd.x
      ? [Math.abs(point.y - lowerTrunk.y)]
      : [],
  )
  expect(Math.min(...centerlineDistances)).toBeGreaterThanOrEqual(0.6)
  expect(Math.max(...centerlineDistances)).toBeLessThanOrEqual(1.600001)
  expect(solver.finalVisualize()).toMatchGraphicsSvg(import.meta.path)
})
