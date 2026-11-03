import { expect, test } from "bun:test"
import { createSearchGeometryValidator } from "../../../lib/post-processing/geometry/createSearchGeometryValidator"
import type { Obstacle } from "../../../lib/types"

test("coupled search permits pour antipads while retaining planar and pad obstacles", () => {
  const plane: Obstacle = {
    type: "rect",
    isCopperPour: true,
    layers: ["inner1", "inner4"],
    center: { x: 0, y: 0 },
    width: 8,
    height: 6,
    connectedTo: [],
  }
  const input = {
    immutableTraces: [],
    obstacles: [plane],
    bounds: { minX: -5, maxX: 5, minY: -4, maxY: 4 },
    layerCount: 6,
    start: { x: -4, y: 0, layer: "top" },
    end: { x: 4, y: 0, layer: "bottom" },
    firstConnectionName: "positive",
    secondConnectionName: "negative",
    firstStartTerminal: { x: -4, y: 0.4 },
    firstEndTerminal: { x: 4, y: 0.4 },
    secondStartTerminal: { x: -4, y: -0.4 },
    secondEndTerminal: { x: 4, y: -0.4 },
    firstWidth: 0.1,
    secondWidth: 0.1,
    firstViaDiameter: 0.35,
    secondViaDiameter: 0.35,
    centerlineSpacing: 0.8,
    side: 1 as const,
  }
  const validator = createSearchGeometryValidator(input)
  const point = { x: 0, y: 0, layer: "top" }
  const direction = { x: 1, y: 0 }
  expect(validator.isViaValid(point, "bottom", direction)).toBe(true)
  expect(
    validator.isEdgeValid(
      { x: -1, y: 0, layer: "inner1" },
      { x: 1, y: 0, layer: "inner1" },
    ),
  ).toBe(false)
  const padValidator = createSearchGeometryValidator({
    ...input,
    obstacles: [{ ...plane, isCopperPour: false }],
  })
  expect(padValidator.isViaValid(point, "bottom", direction)).toBe(false)
  const holeValidator = createSearchGeometryValidator({
    ...input,
    obstacles: [
      {
        type: "rect",
        layers: ["top", "inner1", "inner2", "inner3", "inner4", "bottom"],
        center: { x: 0, y: 0.4 },
        width: 0.3,
        height: 0.3,
        connectedTo: [],
      },
    ],
  })
  expect(holeValidator.isViaValid(point, "bottom", direction)).toBe(false)
  const innerPadValidator = createSearchGeometryValidator({
    ...input,
    obstacles: [
      {
        type: "rect",
        layers: ["inner3"],
        center: { x: 0, y: 0.4 },
        width: 0.3,
        height: 0.3,
        connectedTo: [],
      },
    ],
  })
  expect(innerPadValidator.isViaValid(point, "bottom", direction)).toBe(false)
})
