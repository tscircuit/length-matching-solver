import { expect, test } from "bun:test"
import {
  LengthMatchingConstraintError,
  LengthMatchingSolver,
  type HighDensityRoute,
} from "../../../lib"
import { createLaneMembershipParams } from "../createLaneMembershipParams"

test("rejects fragmented, empty, nonfinite, and unanchored owned copper", (): void => {
  const mutations: ((route: HighDensityRoute) => void)[] = [
    (route): void => {
      route.route = []
    },
    (route): void => {
      route.route[1]!.x -= 1
    },
    (route): void => {
      route.route[1]!.x = Number.NaN
    },
    (route): void => {
      route.route[1]!.z = 1
    },
    (route): void => {
      route.route[1]!.z = 0.5
    },
  ]
  for (const mutate of mutations) {
    const params = createLaneMembershipParams()
    mutate(params.hdRoutes[0]!)
    const solver = new LengthMatchingSolver(params)
    expect(() => solver.solve()).toThrow(LengthMatchingConstraintError)
    expect(solver.failed).toBe(true)
    expect(solver.solved).toBe(false)
  }
  const fragmented = createLaneMembershipParams()
  fragmented.hdRoutes.push(structuredClone(fragmented.hdRoutes[0]!))
  expect(() => new LengthMatchingSolver(fragmented).solve()).toThrow(
    "stitch fragments before matching",
  )
})
