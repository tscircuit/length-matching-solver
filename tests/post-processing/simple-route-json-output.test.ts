import { expect, test } from "bun:test"
import {
  type CompleteSimpleRouteJson,
  PostProcessingSolver,
  type SimpleRouteConnection,
} from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("preserves a complete autorouter SRJ subtype while replacing traces", () => {
  const params = createPostProcessingTestParams({
    routingGrid: { innerGridStep: 0.5 },
  })
  type CompleteAutorouterSimpleRouteJson = CompleteSimpleRouteJson & {
    minTraceWidth: number
    connections: SimpleRouteConnection[]
    autorouterMetadata: { source: string }
  }
  const simpleRouteJson: CompleteAutorouterSimpleRouteJson = {
    ...params.simpleRouteJson,
    minTraceWidth: 0.15,
    connections: [],
    autorouterMetadata: { source: "capacity-autorouter" },
    obstacles: [
      {
        type: "rect",
        layers: ["bottom"],
        __zLayers: [0],
        center: { x: 11.5, y: 4.5 },
        width: 0.25,
        height: 0.25,
        connectedTo: [],
      },
    ],
  }
  const inputSnapshot = structuredClone(simpleRouteJson)
  const solver = new PostProcessingSolver({
    simpleRouteJson,
    routingGrid: params.routingGrid,
  })
  solver.solve()

  const firstOutput = solver.getOutput()
  const typedOutput: CompleteAutorouterSimpleRouteJson =
    firstOutput.simpleRouteJson
  const outputSnapshot = structuredClone(typedOutput)
  expect(Object.keys(typedOutput).sort()).toEqual([
    "autorouterMetadata",
    "bounds",
    "connections",
    "differentialPairs",
    "layerCount",
    "minTraceWidth",
    "obstacles",
    "traces",
  ])
  expect(typedOutput).not.toBe(simpleRouteJson)
  expect(typedOutput.bounds).not.toBe(simpleRouteJson.bounds)
  expect(typedOutput.obstacles).not.toBe(simpleRouteJson.obstacles)
  expect(typedOutput.differentialPairs).not.toBe(
    simpleRouteJson.differentialPairs,
  )
  expect(typedOutput.differentialPairs[0]!.connectionNames).not.toBe(
    simpleRouteJson.differentialPairs[0]!.connectionNames,
  )
  expect(typedOutput.obstacles[0]!.connectedTo).not.toBe(
    simpleRouteJson.obstacles[0]!.connectedTo,
  )
  expect(typedOutput.traces).not.toBe(simpleRouteJson.traces)
  expect(typedOutput.obstacles).toEqual(simpleRouteJson.obstacles)
  expect(typedOutput.differentialPairs).toEqual(
    simpleRouteJson.differentialPairs,
  )
  expect(typedOutput.autorouterMetadata).toEqual(
    simpleRouteJson.autorouterMetadata,
  )

  typedOutput.bounds.minX = -999
  typedOutput.traces[0]!.connection_name = "mutated"
  typedOutput.autorouterMetadata.source = "mutated"
  expect(simpleRouteJson).toEqual(inputSnapshot)
  expect(solver.getOutput().simpleRouteJson).toEqual(outputSnapshot)
})
