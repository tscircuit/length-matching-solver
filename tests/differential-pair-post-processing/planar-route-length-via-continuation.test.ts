import { expect, test } from "bun:test"
import { getPlanarRouteLength } from "../../lib/differential-pair-post-processing/routing/getPlanarRouteLength"
import type { PcbLayer } from "../../lib/differential-pair-post-processing/types"

test("planar route length continues across a via without duplicate wire points", () => {
  const top = "top" as PcbLayer
  const bottom = "bottom" as PcbLayer
  const route = [
    { route_type: "wire", x: 0, y: 0, width: 0.2, layer: top },
    { route_type: "wire", x: 1, y: 0, width: 0.2, layer: top },
    { route_type: "via", x: 1, y: 0, from_layer: top, to_layer: bottom },
    { route_type: "wire", x: 2, y: 0, width: 0.2, layer: bottom },
  ] as const

  expect(getPlanarRouteLength([...route])).toBeCloseTo(2)

  const withDuplicateWireAtVia = [
    ...route.slice(0, 3),
    { route_type: "wire", x: 1, y: 0, width: 0.2, layer: bottom },
    route[3]!,
  ] as const
  expect(getPlanarRouteLength([...withDuplicateWireAtVia])).toBeCloseTo(2)
})
