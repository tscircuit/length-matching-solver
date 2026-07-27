import { expect, test } from "bun:test"
import { findCoupledPath } from "../../../lib/post-processing/routing/findCoupledPath"

test("terminates at an exact endpoint adjacent to a regular grid node", () => {
  const start = { x: 1, y: 1, layer: "top" }
  const end = { x: 2 + 5e-9, y: 2, layer: "top" }
  const path = findCoupledPath({
    start,
    end,
    bounds: { minX: 0, maxX: 4, minY: 0, maxY: 4 },
    layerCount: 2,
    grid: {
      innerGridStep: 0.5,
      outerGridStep: 1,
      outerPerimeterWidth: 1,
    },
    isEdgeValid: () => true,
    isViaValid: () => false,
  })

  expect(path?.[0]).toEqual(start)
  expect(path?.at(-1)).toEqual(end)
  expect(path?.at(-1)?.x).not.toBe(2)
})
