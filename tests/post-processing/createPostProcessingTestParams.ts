import type {
  PostProcessingGridConfig,
  PostProcessingSolverParams,
  SimplifiedPcbTrace,
} from "../../lib"
import {
  createPostProcessingParamsFromSimpleRouteJson,
  type PostProcessingSimpleRouteJsonFixture,
} from "../../fixtures/createPostProcessingParamsFromSimpleRouteJson"

type PostProcessingTestParamsOverrides = {
  simpleRouteJson?: Partial<PostProcessingSimpleRouteJsonFixture>
  routingGrid?: PostProcessingGridConfig
}

export type PostProcessingTestParams = PostProcessingSolverParams & {
  simpleRouteJson: PostProcessingSimpleRouteJsonFixture
}

export const createPostProcessingTestParams = (
  overrides: PostProcessingTestParamsOverrides = {},
): PostProcessingTestParams => {
  const createTrace = (
    id: string,
    connectionName: string,
    y: number,
  ): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: id,
    connection_name: connectionName,
    route: [
      { route_type: "wire", x: 0, y, width: 0.2, layer: "top" },
      { route_type: "wire", x: 10, y, width: 0.2, layer: "top" },
    ],
  })
  const simpleRouteJson: PostProcessingSimpleRouteJsonFixture = {
    traces: [createTrace("trace_p", "P", 2), createTrace("trace_n", "N", -2)],
    differentialPairs: [{ connectionNames: ["P", "N"], lengthTolerance: 0.01 }],
    obstacles: [],
    bounds: { minX: -2, maxX: 12, minY: -5, maxY: 5 },
    layerCount: 2,
    ...overrides.simpleRouteJson,
  }
  return {
    ...createPostProcessingParamsFromSimpleRouteJson(
      simpleRouteJson,
      overrides.routingGrid,
    ),
    simpleRouteJson,
  }
}
