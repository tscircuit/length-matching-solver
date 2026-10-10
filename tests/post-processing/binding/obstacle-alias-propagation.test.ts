import { expect, test } from "bun:test"
import { createPostProcessingModel } from "../../../lib/post-processing/binding/createPostProcessingModel"
import type { PostProcessingSolverParams } from "../../../lib/post-processing/types"

test("indexes obstacle aliases with ordered forward propagation and immutable metadata", () => {
  const hdRoutes = [
    {
      connectionName: "early",
      rootConnectionName: "later",
      startPcbPortId: "unused",
    },
    {
      connectionName: "routed",
      rootConnectionName: "seed",
      startPcbPortId: "later",
      endPcbPortId: "out",
    },
    {
      connectionName: "forward",
      rootConnectionName: "out",
      startPcbPortId: "",
      endPcbPortId: "end",
    },
    {
      connectionName: "repeat",
      rootConnectionName: "seed",
      startPcbPortId: "end",
    },
  ].map((names, index) => ({
    ...names,
    traceThickness: 0.1,
    viaDiameter: 0.5,
    route: [
      { x: index, y: 0, z: 0 },
      { x: index + 1, y: 0, z: 0 },
    ],
    vias: [],
    metadata: { preserve: index },
  }))
  const seedObstacle = {
    type: "rect" as const,
    center: { x: 0, y: 2 },
    width: 0.5,
    height: 0.5,
    layers: ["top"],
    connectedTo: ["seed", "seed"],
    metadata: { preserved: [1, 2, 3] },
  }
  const earlyObstacle = { ...seedObstacle, connectedTo: ["early", "seed"] }
  const untouchedObstacle = {
    ...seedObstacle,
    connectedTo: ["untouched", "untouched"],
  }
  const params: PostProcessingSolverParams = {
    hdRoutes,
    differentialPairs: [
      { connectionNames: ["early", "forward"], lengthTolerance: 0.1 },
    ],
    obstacles: [seedObstacle, earlyObstacle, untouchedObstacle, seedObstacle],
    bounds: { minX: -1, maxX: 10, minY: -5, maxY: 5 },
    layerCount: 2,
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "fixed",
        connection_name: "early",
        route: [
          { route_type: "wire", x: -1, y: -1, width: 0.1, layer: "top" },
          { route_type: "wire", x: 5, y: -1, width: 0.1, layer: "top" },
        ],
      },
    ],
    routingGrid: { innerGridStep: 0.1, outerGridStep: 1, outerPerimeterWidth: 3 },
  }
  const original = structuredClone(params)
  const model = createPostProcessingModel(params)
  const obstacles = model.params.simpleRouteJson.obstacles
  expect(obstacles.map((obstacle) => obstacle.connectedTo)).toEqual([
    ["seed", "routed", "later", "out", "forward", "", "end", "repeat"],
    [
      "early",
      "seed",
      "later",
      "unused",
      "routed",
      "out",
      "forward",
      "",
      "end",
      "repeat",
    ],
    ["untouched", "untouched"],
    ["seed", "routed", "later", "out", "forward", "", "end", "repeat"],
  ])
  expect(obstacles[0]).toBe(obstacles[3])
  expect(obstacles[0]).not.toBe(seedObstacle)
  expect(obstacles[0]!.connectedTo).not.toContain("early")
  expect(model.routeBindings).toEqual([
    { hdRouteIndex: 0, traceIndex: 0, internalConnectionName: "early" },
    { hdRouteIndex: 2, traceIndex: 2, internalConnectionName: "forward" },
  ])
  expect(model.params.simpleRouteJson.traces.at(-1)?.connection_name).toBe(
    "post_processing_fixed_trace_0",
  )
  expect(model.sourceHdRoutes).toEqual(hdRoutes)
  expect(model.sourceHdRoutes).not.toBe(hdRoutes)
  expect(model.params.routingGrid).toEqual(params.routingGrid)
  expect(
    obstacles.map((obstacle) => (obstacle as typeof seedObstacle).metadata),
  ).toEqual(Array(4).fill(seedObstacle.metadata))
  expect(params).toEqual(original)
})
