import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type DifferentialPair,
  type SimplifiedPcbTrace,
} from "../../../lib"
import { createPostProcessingParamsFromSimpleRouteJson } from "../../../fixtures/createPostProcessingParamsFromSimpleRouteJson"

test("escapes an interleaved terminal pad before coupling the pair", () => {
  const createTrace = (
    connectionName: string,
    y: number,
  ): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `trace_${connectionName.toLowerCase()}`,
    connection_name: connectionName,
    route: [0, 20].map((x) => ({
      route_type: "wire",
      x,
      y,
      width: 0.15,
      layer: "top",
    })),
  })
  const differentialPair: DifferentialPair = {
    connectionNames: ["P", "N"],
    lengthTolerance: 0.1,
    minimumCenterlineDistance: 0.3,
    maximumCenterlineDistance: 0.3,
    maxUncoupledLength: 3,
  }
  const solver = new PostProcessingSolver(
    createPostProcessingParamsFromSimpleRouteJson({
      traces: [createTrace("P", 0.5), createTrace("N", -0.5)],
      differentialPairs: [differentialPair],
      obstacles: [0, 20].flatMap((x) => [
        {
          type: "rect" as const,
          center: { x, y: 0.5 },
          width: 1,
          height: 0.3,
          layers: ["top"],
          connectedTo: ["P"],
        },
        {
          type: "rect" as const,
          center: { x, y: 0 },
          width: 1,
          height: 0.3,
          layers: ["top"],
          connectedTo: [],
        },
        {
          type: "rect" as const,
          center: { x, y: -0.5 },
          width: 1,
          height: 0.3,
          layers: ["top"],
          connectedTo: ["N"],
        },
      ]),
      bounds: { minX: -0.6, maxX: 20.6, minY: -1.2, maxY: 1.2 },
      layerCount: 2,
    }),
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(
    solver.getOutput().postProcessingErrors.map((error) => error.reason),
  ).toEqual([])
  expect(solver.finalVisualize()).toMatchGraphicsSvg(import.meta.path)
})
