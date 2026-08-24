import { expect, test } from "bun:test"
import { crossLayerCenterlineCrash } from "../../fixtures/cross-layer-centerline-crash/cross-layer-centerline-crash"
import { LengthMatchingSolver } from "../../lib"
import { getRouteLength } from "../../lib/route-geometry"

test("continues to a same-layer candidate after an unmeasurable candidate", () => {
  const solver = new LengthMatchingSolver(crossLayerCenterlineCrash)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.matchedHdRoutes[0]!.route.length).toBeGreaterThan(4)
  expect(getRouteLength(solver.matchedHdRoutes[0]!)).toBeCloseTo(
    getRouteLength(solver.matchedHdRoutes[1]!),
    2,
  )
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
