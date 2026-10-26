import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../../lib"

test("rejects invalid retained connection lengths before matching", (): void => {
  for (const length of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const solver = new LengthMatchingSolver({
      hdRoutes: [],
      originalConnections: [],
      fixedLengthByConnectionName: { invalid: length },
    })
    expect(() => solver.solve()).toThrow(
      'LengthMatchingSolver: fixed length for connection "invalid" must be a nonnegative finite number',
    )
    expect(solver.solved).toBe(false)
  }
})
