import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../../lib"
import { createLaneMembershipParams } from "./createLaneMembershipParams"

test("fails instead of reporting a matched pair when both lanes have no routes", () => {
  const params = createLaneMembershipParams()
  params.hdRoutes = []
  const solver = new LengthMatchingSolver(params)

  expect(() => solver.solve()).toThrow()
  expect(solver.solved).toBe(false)
})
