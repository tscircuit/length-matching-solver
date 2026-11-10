import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../../lib"
import { createLaneMembershipParams } from "./createLaneMembershipParams"

test("accepts unequal hop counts and counts only planar copper across vias", (): void => {
  const params = createLaneMembershipParams()
  params.hdRoutes = params.hdRoutes.filter((route) => route.connectionName !== "N:1")
  const negative = params.hdRoutes[2]!
  negative.route = [
    { x: 0, y: 4, z: 0 },
    { x: 10, y: 4, z: 0 },
    { x: 10, y: 4, z: 1 },
    { x: 20, y: 4, z: 1 },
  ]
  negative.vias = [{ x: 10, y: 4, zLayers: [0, 1] }]
  params.originalConnections[2]!.pointsToConnect[1] = { x: 20, y: 4, layer: "bottom" }
  params.differentialPairs![0]!.connectionNames[1] = ["N:0"]
  const solver = new LengthMatchingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.getOutput().matchedHdRoutes).toEqual(params.hdRoutes)
})
