import { expect, test } from "bun:test"
import { findCoupledPath } from "../../../lib/post-processing/routing/findCoupledPath"

test("preserves searched corners at the minimum supported inner-grid scale", () => {
  const start = { x: 0.0004, y: 0.0004, layer: "top" }
  const end = { x: 0.0016, y: 0.0016, layer: "top" }
  const path = findCoupledPath({
    start,
    end,
    bounds: { minX: 0, maxX: 0.002, minY: 0, maxY: 0.002 },
    layerCount: 2,
    grid: {
      innerGridStep: 0.0001,
      outerGridStep: 0.0002,
      outerPerimeterWidth: 0.0002,
    },
    isEdgeValid: (from, to) => from.x === to.x || from.y === to.y,
    isViaValid: () => false,
  })

  expect(path?.[0]).toEqual(start)
  expect(path?.at(-1)).toEqual(end)
  expect(path?.length).toBeGreaterThanOrEqual(3)
})
