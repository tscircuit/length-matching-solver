import { expect, test } from "bun:test"
import { IncrementalCoupledPathSearch } from "../../../lib/post-processing/routing/IncrementalCoupledPathSearch"

test("keeps the checked via direction and crosses four layers in one transition", (): void => {
  const search = new IncrementalCoupledPathSearch({
    start: { x: 0, y: 0, layer: "top" },
    startDirection: { x: 1, y: 0 },
    end: { x: 2, y: 1, layer: "bottom" },
    bounds: { minX: -2, maxX: 4, minY: -2, maxY: 3 },
    layerCount: 4,
    allowNonAdjacentLayerTransitions: true,
    grid: { innerGridStep: 0.25, outerGridStep: 1, outerPerimeterWidth: 1 },
    isEdgeValid: (start, end): boolean =>
      start.layer === "bottom" && end.x >= start.x,
    isViaValid: (point, layer, direction): boolean =>
      point.x === 0 && point.y === 0 && layer === "bottom" && direction.x === 1,
  })
  while (!search.isComplete()) search.step()
  const path = search.getPath()
  expect(path).not.toBeNull()
  expect(path!.slice(0, 2)).toEqual([
    { x: 0, y: 0, layer: "top" },
    { x: 0, y: 0, layer: "bottom" },
  ])
  expect(path![2]!.x).toBeGreaterThan(0)
  expect(path![2]!.y).toBe(0)
  expect(path!.at(-1)).toEqual({ x: 2, y: 1, layer: "bottom" })
})
