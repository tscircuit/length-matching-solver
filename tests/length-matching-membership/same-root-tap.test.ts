import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../../lib"
import { createLaneMembershipParams } from "./createLaneMembershipParams"

test("excludes tap copper sharing the root of a selected lane hop", () => {
  const params = createLaneMembershipParams()
  params.hdRoutes.push({
    connectionName: "P_TAP",
    rootConnectionName: "P_BEFORE",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    route: [
      { x: 5, y: 0, z: 0 },
      { x: 5, y: -10, z: 0 },
    ],
    vias: [],
  })
  const solver = new LengthMatchingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.getOutput().matchedHdRoutes).toEqual(params.hdRoutes)
})
