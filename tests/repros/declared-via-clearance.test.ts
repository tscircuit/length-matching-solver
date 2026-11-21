import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../lib"
import { createPostProcessingModel } from "../../lib/post-processing/binding/createPostProcessingModel"
import { createPostProcessingVisualization } from "../../lib/post-processing/visualization/createPostProcessingVisualization"
import { getRouteLength } from "../../lib/route-geometry/getRouteLength"

test("reproduces blocked paired-via rerouting", () => {
  const params: PostProcessingSolverParams = {
    hdRoutes: [
      {
        connectionName: "P",
        traceThickness: 0.1,
        viaDiameter: 0.35,
        route: [
          { x: 0, y: 0.25, z: 0 },
          { x: 2, y: 0.25, z: 0 },
          { x: 2, y: 0.25, z: 1 },
          { x: 4, y: 0.25, z: 1 },
        ],
        vias: [{ x: 2, y: 0.25, zLayers: [0, 1] }],
      },
      {
        connectionName: "N",
        traceThickness: 0.1,
        viaDiameter: 0.35,
        route: [
          { x: 0, y: -0.25, z: 0 },
          { x: 2, y: -0.25, z: 0 },
          { x: 2, y: -0.25, z: 1 },
          { x: 4, y: -0.25, z: 1 },
        ],
        vias: [{ x: 2, y: -0.25, zLayers: [0, 1] }],
      },
    ],
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "neighbor",
        connection_name: "neighbor",
        route: [
          { route_type: "wire", x: 0, y: 0.7, width: 0.1, layer: "bottom" },
          { route_type: "wire", x: 4, y: 0.7, width: 0.1, layer: "bottom" },
        ],
      },
    ],
    differentialPairs: [{ connectionNames: ["P", "N"], lengthTolerance: 0.01 }],
    obstacles: [],
    bounds: { minX: -0.5, maxX: 4.5, minY: -0.75, maxY: 0.9 },
    layerCount: 2,
    minTraceToPadEdgeClearance: 0.1,
  }
  const solver = new PostProcessingSolver(params)
  solver.solve()
  const output = solver.getOutput()
  expect(output.postProcessingErrors).toHaveLength(1)
  expect(output.postProcessingErrors[0]?.reason).toBe("no-valid-candidate")
  expect(
    output.hdRoutes.map((route) => route.vias.map((via) => via.x)),
  ).toEqual([[2], [2]])
  for (const [index, route] of output.hdRoutes.entries()) {
    expect(route.route[0]).toMatchObject(params.hdRoutes[index]!.route[0]!)
    expect(route.route.at(-1)).toMatchObject(
      params.hdRoutes[index]!.route.at(-1)!,
    )
  }
  const lengths = output.hdRoutes.map(getRouteLength)
  expect(Math.abs(lengths[0]! - lengths[1]!)).toBeLessThanOrEqual(0.01)

  const model = createPostProcessingModel({
    ...params,
    hdRoutes: output.hdRoutes,
  }).params.simpleRouteJson
  expect(
    createPostProcessingVisualization({
      ...model,
      activeConnectionNames: null,
      previewPath: null,
    }),
  ).toMatchGraphicsSvg(import.meta.path, { backgroundColor: "white" })
})
