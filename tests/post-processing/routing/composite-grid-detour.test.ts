import { expect, test } from "bun:test"
import { IncrementalCoupledPathSearch } from "../../../lib/post-processing/routing/IncrementalCoupledPathSearch"
import type { CoupledPathPoint } from "../../../lib/post-processing/routing/types"

const edgeCrossesBlockedInterior = (
  start: CoupledPathPoint,
  end: CoupledPathPoint,
): boolean => {
  const samples = 40
  for (let index = 0; index <= samples; index++) {
    const progress = index / samples
    const x = start.x + (end.x - start.x) * progress
    const y = start.y + (end.y - start.y) * progress
    if (x > 8 && x < 12 && y > 2 && y < 8) return true
  }
  return false
}

test("deterministically searches a fine interior joined to a coarse outer perimeter", () => {
  const input = {
    start: { x: 3.0000004, y: 5.0000004, layer: "top" },
    end: { x: 16.9999996, y: 4.9999996, layer: "top" },
    bounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
    layerCount: 2,
    grid: {
      innerGridStep: 0.5,
      outerGridStep: 2,
      outerPerimeterWidth: 2,
    },
    isEdgeValid: (start: CoupledPathPoint, end: CoupledPathPoint): boolean =>
      !edgeCrossesBlockedInterior(start, end),
    isViaValid: (): boolean => false,
  }
  const solve = (): {
    path: CoupledPathPoint[] | null
    explored: number
    nodes: number
  } => {
    const search = new IncrementalCoupledPathSearch(input)
    while (!search.isComplete()) search.step()
    return {
      path: search.getPath(),
      explored: search.getExploredCount(),
      nodes: search.getGridNodeCount(),
    }
  }

  const first = solve()
  const second = solve()
  expect(first).toEqual(second)
  expect(first.path?.[0]).toEqual(input.start)
  expect(first.path?.at(-1)).toEqual(input.end)
  expect(
    first.path?.some(
      (point) => point.x > 2 && point.x < 18 && point.y > 2 && point.y < 8,
    ),
  ).toBe(true)
  expect(first.path?.some((point) => point.y <= 2 || point.y >= 8)).toBe(true)
  expect(first.nodes).toBeLessThan(800)
  expect(first.explored).toBeGreaterThan(1)
})
