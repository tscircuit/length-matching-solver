import { expect, test } from "bun:test"
import {
  LengthMatchingConstraintError,
  LengthMatchingSolver,
  type LengthMatchingPair,
} from "../../../lib"
import { createLaneMembershipParams } from "../createLaneMembershipParams"

test("rejects invalid memberships, ambiguous originals, and invalid skew limits", (): void => {
  const invalidPairs: unknown[] = [
    { connectionNames: [[], ["N:0"]], maxLengthSkewMm: 0.01 },
    { connectionNames: [["P:0", "P:0"], ["N:0"]], maxLengthSkewMm: 0.01 },
    { connectionNames: [["P:0"], ["P:0"]], maxLengthSkewMm: 0.01 },
    { connectionNames: [["UNKNOWN"], ["N:0"]], maxLengthSkewMm: 0.01 },
    { connectionNames: [["P:0"], ["N:0"]], maxLengthSkewMm: -1 },
    { connectionNames: [["P:0"], ["N:0"]], maxLengthSkewMm: Number.NaN },
    { connectionNames: [["P:0"], ["N:0"]], maxLengthSkewMm: Infinity },
    { connectionNames: ["P:0", "N:0"], maxLengthSkewMm: 0.01 },
  ]
  for (const invalidPair of invalidPairs) {
    const params = createLaneMembershipParams()
    // SAFETY: Exercise runtime rejection of inputs outside the public type.
    params.differentialPairs = [invalidPair as LengthMatchingPair]
    const solver = new LengthMatchingSolver(params)
    expect(() => solver.solve()).toThrow(LengthMatchingConstraintError)
    expect(solver.failed).toBe(true)
    expect(solver.solved).toBe(false)
  }
  const ambiguous = createLaneMembershipParams()
  ambiguous.originalConnections.push(ambiguous.originalConnections[0]!)
  expect(() => new LengthMatchingSolver(ambiguous).solve()).toThrow(
    "exactly one original connection",
  )

  const shared = createLaneMembershipParams()
  shared.differentialPairs!.push(shared.differentialPairs![0]!)
  expect(() => new LengthMatchingSolver(shared).solve()).toThrow(
    "belongs to multiple pairs",
  )

  const multiTerminal = createLaneMembershipParams()
  multiTerminal.originalConnections[0]!.pointsToConnect.push({
    x: 1,
    y: 1,
    layer: "top",
  })
  expect(() => new LengthMatchingSolver(multiTerminal).solve()).toThrow(
    "exactly two points",
  )
})
