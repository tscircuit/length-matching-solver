import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../../lib"
import { getRouteLength } from "../../lib/route-geometry"
import { createLaneMembershipParams } from "./createLaneMembershipParams"

test("tunes the summed lane deficit while retaining real roots and other copper", (): void => {
  const params = createLaneMembershipParams()
  params.hdRoutes[1]!.route[1]!.x -= 2
  params.originalConnections[1]!.pointsToConnect[1]!.x -= 2
  const solver = new LengthMatchingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.getOutput().matchedHdRoutes
  const lengths = output.map(getRouteLength)
  expect(Math.abs(lengths[0]! + lengths[1]! - lengths[2]! - lengths[3]!)).toBeLessThanOrEqual(0.01)
  expect(output.map((route) => route.rootConnectionName)).toEqual(
    params.hdRoutes.map((route) => route.rootConnectionName),
  )
  expect(output.slice(2)).toEqual(params.hdRoutes.slice(2))
  expect(params.hdRoutes.map(getRouteLength)).toEqual([5, 13, 10, 10])
})
