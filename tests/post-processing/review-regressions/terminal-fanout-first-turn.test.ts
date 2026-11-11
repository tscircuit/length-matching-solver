import { expect, test } from "bun:test"
import { createSearchGeometryValidator } from "../../../lib/post-processing/geometry/createSearchGeometryValidator"

test("rejects a first turn whose lane offset collides with an interleaved terminal pad", () => {
  const firstStart = { x: 92.2649597, y: 18.499991, layer: "top" }
  const secondStart = { x: 92.2649597, y: 17.499993, layer: "top" }
  const firstEnd = { x: 44.907534, y: 16.249932, layer: "top" }
  const secondEnd = { x: 44.907534, y: 15.75006, layer: "top" }
  const start = {
    x: 83.38202042858745,
    y: 17.624848234297634,
    layer: "top",
  }
  const end = {
    x: 45.64213848949582,
    y: 16.031019773333476,
    layer: "top",
  }
  const midpointStart = {
    x: (firstStart.x + secondStart.x) / 2,
    y: (firstStart.y + secondStart.y) / 2,
  }
  const midpointEnd = {
    x: (firstEnd.x + secondEnd.x) / 2,
    y: (firstEnd.y + secondEnd.y) / 2,
  }
  const length = Math.hypot(
    midpointEnd.x - midpointStart.x,
    midpointEnd.y - midpointStart.y,
  )
  const spineDirection = {
    x: (midpointEnd.x - midpointStart.x) / length,
    y: (midpointEnd.y - midpointStart.y) / length,
  }
  const validator = createSearchGeometryValidator({
    immutableTraces: [],
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 92.2649597, y: 18.000119 },
        width: 2.5999948,
        height: 0.2999994,
        connectedTo: [],
      },
    ],
    bounds: { minX: 25, maxX: 104, minY: -9, maxY: 33 },
    layerCount: 4,
    start,
    end,
    firstConnectionName: "P",
    secondConnectionName: "N",
    firstStartTerminal: firstStart,
    firstEndTerminal: firstEnd,
    secondStartTerminal: secondStart,
    secondEndTerminal: secondEnd,
    firstWidth: 0.15,
    secondWidth: 0.15,
    firstViaDiameter: 0.6,
    secondViaDiameter: 0.6,
    centerlineSpacing: 0.3,
    side: -1,
    terminalFanout: false,
    terminalMiterMargin: 0.15,
  })

  expect(validator.isTerminalFanoutValid(start, spineDirection, "start")).toBe(
    true,
  )
  expect(
    validator.isEdgeValid(start, {
      x: start.x - 1.5,
      y: start.y - 1.5,
      layer: "top",
    }),
  ).toBe(false)
  expect(
    validator.isEdgeValid(start, {
      x: start.x - 1.5,
      y: start.y,
      layer: "top",
    }),
  ).toBe(true)
})
