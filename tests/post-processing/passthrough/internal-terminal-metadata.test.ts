import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"
import { createPostProcessingModel } from "../../../lib/post-processing/binding/createPostProcessingModel"
import { createPostProcessingVisualization } from "../../../lib/post-processing/visualization/createPostProcessingVisualization"

test("passes through an internal branch terminal without changing the route", () => {
  const params: PostProcessingSolverParams = {
    hdRoutes: [
      {
        connectionName: "source_trace_261__source_net_261_mst1",
        rootConnectionName: "source_trace_261",
        startPcbPortId: "pcb_port_933",
        endPcbPortId: "pcb_port_691",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        route: [
          {
            x: -23.755,
            y: -6.66,
            z: 5,
            pcb_port_id: "pcb_port_933",
          },
          {
            x: -22.795,
            y: -7.67,
            z: 5,
            pcb_port_id: "pcb_port_873",
          },
          { x: -22.776, y: -7.4, z: 5 },
          {
            x: -22.776,
            y: -7.4,
            z: 0,
            pcb_port_id: "pcb_port_691",
          },
        ],
        vias: [{ x: -22.776, y: -7.4, zLayers: [0, 1, 2, 3, 4, 5] }],
      },
    ],
    differentialPairs: [],
    obstacles: [
      {
        type: "rect",
        center: { x: -23.755, y: -6.66 },
        width: 0.5,
        height: 0.5,
        layers: ["bottom"],
        connectedTo: ["pcb_port_933"],
      },
      {
        type: "rect",
        center: { x: -22.795, y: -7.67 },
        width: 0.5,
        height: 0.5,
        layers: ["bottom"],
        connectedTo: ["pcb_port_873"],
      },
      {
        type: "rect",
        center: { x: -22.776, y: -7.4 },
        width: 0.5,
        height: 0.5,
        layers: ["top"],
        connectedTo: ["pcb_port_691"],
      },
    ],
    bounds: { minX: -24.2, maxX: -22.2, minY: -8.1, maxY: -6.1 },
    layerCount: 6,
    allowViaInPad: true,
  }

  let solver: PostProcessingSolver | undefined
  let error: Error | undefined
  try {
    solver = new PostProcessingSolver(params)
    solver.solve()
  } catch (caughtError) {
    error = caughtError as Error
  }

  const output = solver?.getOutput().hdRoutes ?? params.hdRoutes
  const model = createPostProcessingModel({ ...params, hdRoutes: output })
  const graphics = createPostProcessingVisualization({
    traces: model.params.simpleRouteJson.traces,
    obstacles: model.params.simpleRouteJson.obstacles,
    bounds: model.params.simpleRouteJson.bounds,
    layerCount: model.params.simpleRouteJson.layerCount,
    activeConnectionNames: null,
    previewPath: null,
  })
  graphics.title = error
    ? "Rejected pass-through: internal pcb_port_873"
    : "Passed through unchanged: internal pcb_port_873 preserved"
  graphics.texts = [
    {
      x: -23.2,
      y: -6.2,
      text: error
        ? "Rejected: pass-through would not accept the internal terminal"
        : "Accepted: pass-through returned the same route and terminal IDs",
      anchorSide: "top_center",
      color: "#111827",
      fontSize: 0.045,
    },
    {
      x: -23.82,
      y: -6.4,
      text: "start: pcb_port_933",
      anchorSide: "bottom_center",
      color: "#1d4ed8",
      fontSize: 0.04,
      layer: "z5",
    },
    {
      x: -23.15,
      y: -7.95,
      text: "internal branch terminal: pcb_port_873",
      anchorSide: "top_center",
      color: "#1d4ed8",
      fontSize: 0.04,
      layer: "z5",
    },
    {
      x: -22.55,
      y: -7.15,
      text: "end: pcb_port_691",
      anchorSide: "center_left",
      color: "#1d4ed8",
      fontSize: 0.04,
      layer: "z0",
    },
  ]
  graphics.points!.push(
    {
      x: -23.755,
      y: -6.66,
      color: "#2563eb",
      label: "start pcb_port_933",
      layer: "z5",
    },
    {
      x: -22.795,
      y: -7.67,
      color: "#2563eb",
      label: "internal branch pcb_port_873",
      layer: "z5",
    },
    {
      x: -22.776,
      y: -7.4,
      color: "#2563eb",
      label: "end pcb_port_691",
      layer: "z0",
    },
  )

  expect(error?.message ?? "passed through unchanged").toMatch(
    /unsupported PCB-port metadata|passed through unchanged/,
  )
  if (solver) expect(output).toEqual(params.hdRoutes)
  expect(graphics).toMatchGraphicsSvg(import.meta.path)
})
