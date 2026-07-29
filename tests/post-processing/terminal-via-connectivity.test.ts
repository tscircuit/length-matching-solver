import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("preserves endpoint connectivity and port metadata for terminal-via routes", () => {
  const makeRoute = (
    id: string,
    connectionName: string,
    y: number,
  ): HighDensityRoute => ({
    connectionName,
    startPcbPortId: `${id}_start`,
    endPcbPortId: `${id}_end`,
    traceThickness: 0.2,
    viaDiameter: 0.4,
    route: [
      { x: 0, y, z: 0, pcb_port_id: `${id}_start` },
      { x: 0, y, z: 1 },
      { x: 10, y, z: 1 },
      { x: 10, y, z: 0, pcb_port_id: `${id}_end` },
    ],
    vias: [
      { x: 0, y, zLayers: [0, 1] },
      { x: 10, y, zLayers: [0, 1] },
    ],
  })
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver({
    ...params,
    hdRoutes: [makeRoute("p", "P", 0.5), makeRoute("n", "N", -0.5)],
  })
  solver.solve()
  const { hdRoutes } = solver.getOutput()
  for (const hdRoute of hdRoutes) {
    const id = hdRoute.connectionName.toLowerCase()
    expect(hdRoute.route[0]!.z).toBe(0)
    expect(hdRoute.route.at(-1)!.z).toBe(0)
    expect(hdRoute.startPcbPortId).toBe(`${id}_start`)
    expect(hdRoute.endPcbPortId).toBe(`${id}_end`)
    expect(hdRoute.route[0]!.pcb_port_id).toBe(`${id}_start`)
    expect(hdRoute.route.at(-1)!.pcb_port_id).toBe(`${id}_end`)
  }
})
