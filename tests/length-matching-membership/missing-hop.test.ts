import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../../lib"
import { createLaneMembershipParams } from "./createLaneMembershipParams"

test("rejects a lane with just one of its declared hops missing", () => {
  const params = createLaneMembershipParams()
  params.hdRoutes = params.hdRoutes.filter(
    (route) => route.connectionName !== "P:1",
  )
  const solver = new LengthMatchingSolver(params)

  expect(() => solver.solve()).toThrow('missing route for connection "P:1"')
  expect(solver.solved).toBe(false)
})
