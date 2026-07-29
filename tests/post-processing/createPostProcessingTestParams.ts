import type {
  CompleteSimpleRouteJson,
  PostProcessingGridConfig,
  PostProcessingSolverParams,
  SimplifiedPcbTrace,
} from "../../lib"

type PostProcessingTestParamsOverrides = {
  simpleRouteJson?: Partial<CompleteSimpleRouteJson>
  routingGrid?: PostProcessingGridConfig
}

export const createPostProcessingTestParams = (
  overrides: PostProcessingTestParamsOverrides = {},
): PostProcessingSolverParams => {
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
  const simpleRouteJson: CompleteSimpleRouteJson = {
    traces: [createTrace("trace_p", "P", 2), createTrace("trace_n", "N", -2)],
    differentialPairs: [{ connectionNames: ["P", "N"], lengthTolerance: 0.01 }],
    obstacles: [],
    bounds: { minX: -2, maxX: 12, minY: -5, maxY: 5 },
    layerCount: 2,
    ...overrides.simpleRouteJson,
  }
  return {
    simpleRouteJson,
    ...(overrides.routingGrid ? { routingGrid: overrides.routingGrid } : {}),
  }
}
