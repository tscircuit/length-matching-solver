import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../../lib"
import { getRouteLength } from "../../lib/route-geometry"
import { createLaneMembershipParams } from "./createLaneMembershipParams"

test("accepts P hops of 5+15mm and N hops of 10+10mm without per-hop tuning", () => {
  const params = createLaneMembershipParams()
  const solver = new LengthMatchingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.getOutput().matchedHdRoutes
  expect(output).toEqual(params.hdRoutes)
  expect(output.map(getRouteLength)).toEqual([5, 15, 10, 10])
})
