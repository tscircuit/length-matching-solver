import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../../../lib"
import { createLaneMembershipParams } from "../createLaneMembershipParams"

test("rechecks committed copper before marking a solve successful", (): void => {
  const solver = new LengthMatchingSolver(createLaneMembershipParams())
  solver.step()
  expect(solver.solved).toBe(false)
  solver.matchedHdRoutes[0]!.route.splice(1, 0, { x: 2, y: -2, z: 0 })

  expect(() => solver.step()).toThrow("exceed maxLengthSkewMm")
  expect(solver.failed).toBe(true)
  expect(solver.solved).toBe(false)
  expect(() => solver.getOutput()).toThrow("before the solver completed")
})
