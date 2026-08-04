import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("keeps the native HD-route input and returned output immutable", () => {
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams({
      routingGrid: { innerGridStep: 0.5 },
    })
  params.hdRoutes[0]!.connectionName = "P_SEGMENT"
  params.differentialPairs[0]!.connectionNames = ["P_SEGMENT", "N"]
  params.hdRoutes[0]!.rootConnectionName = "P"
  params.hdRoutes[0]!.startPcbPortId = "p_start"
  params.hdRoutes[0]!.endPcbPortId = "p_end"
  params.hdRoutes[0]!.regionId = "region_a"
  params.hdRoutes[0]!.route[0]!.pcb_port_id = "p_start"
  params.hdRoutes[0]!.route.at(-1)!.pcb_port_id = "p_end"
  params.obstacles.push({
    type: "rect",
    layers: ["top"],
    center: { x: 0, y: 2 },
    width: 0.25,
    height: 0.25,
    connectedTo: ["P_SEGMENT"],
  })
  const immutableViaRoute: HighDensityRoute = {
    connectionName: "OTHER",
    traceThickness: 0.2,
    viaDiameter: 0.5,
    route: [
      { x: 11, y: 4, z: 0 },
      { x: 11, y: 4, z: 1 },
    ],
    vias: [{ x: 11, y: 4, zLayers: [0, 1] }],
  }
  params.hdRoutes.push(immutableViaRoute)

  const inputSnapshot = structuredClone(params)
  const solver = new PostProcessingSolver(params)
  solver.solve()

  const firstOutput = solver.getOutput()
  const outputSnapshot = structuredClone(firstOutput)
  expect(Object.keys(firstOutput)).toEqual(["hdRoutes", "postProcessingErrors"])
  expect(firstOutput.hdRoutes).not.toBe(params.hdRoutes)
  expect(firstOutput.hdRoutes[0]).not.toBe(params.hdRoutes[0])
  expect(firstOutput.hdRoutes[0]!.route).not.toBe(params.hdRoutes[0]!.route)
  expect(firstOutput.hdRoutes[0]).toMatchObject({
    connectionName: "P_SEGMENT",
    rootConnectionName: "P",
    startPcbPortId: "p_start",
    endPcbPortId: "p_end",
    regionId: "region_a",
  })
  expect(firstOutput.hdRoutes[0]!.route[0]!.pcb_port_id).toBe("p_start")
  expect(firstOutput.hdRoutes[0]!.route.at(-1)!.pcb_port_id).toBe("p_end")
  expect(firstOutput.hdRoutes[2]!.vias).not.toBe(immutableViaRoute.vias)
  expect(firstOutput.hdRoutes[2]!.vias[0]!.zLayers).not.toBe(
    immutableViaRoute.vias[0]!.zLayers,
  )

  firstOutput.hdRoutes[0]!.connectionName = "mutated"
  firstOutput.hdRoutes[0]!.route[0]!.x = -999
  firstOutput.hdRoutes[2]!.vias[0]!.x = -999
  firstOutput.hdRoutes[2]!.vias[0]!.zLayers![0] = 1
  expect(params).toEqual(inputSnapshot)
  expect(solver.getOutput()).toEqual(outputSnapshot)
})
