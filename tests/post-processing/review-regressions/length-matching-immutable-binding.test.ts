import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { createLengthMatchingBinding } from "../../../lib/post-processing/binding/createLengthMatchingBinding"

test("binds untargeted and special traces as collision-only immutable copper", () => {
  const createWireTrace = (
    connectionName: string,
    y: number,
  ): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `trace_${connectionName}`,
    connection_name: connectionName,
    route: [
      { route_type: "wire", x: 0, y, width: 0.2, layer: "top" },
      { route_type: "wire", x: 5, y, width: 0.2, layer: "top" },
    ],
  })
  const specialTrace: SimplifiedPcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace_special",
    connection_name: "SPECIAL",
    route: [
      { route_type: "wire", x: 1, y: 4, width: 0.2, layer: "top" },
      {
        route_type: "jumper",
        start: { x: 1, y: 4 },
        end: { x: 3, y: 4 },
        footprint: "1206",
        layer: "top",
      },
      { route_type: "wire", x: 4, y: 4, width: 0.2, layer: "top" },
    ],
  }
  const traces = [
    createWireTrace("P", 1),
    createWireTrace("N", 2),
    createWireTrace("UNTARGETED_P", 3),
    createWireTrace("UNTARGETED_N", 3.5),
    specialTrace,
  ]
  const binding = createLengthMatchingBinding({
    result: {
      traces,
      reroutedPairs: [{ connectionNames: ["P", "N"], lengthTolerance: 0.01 }],
    },
    params: {
      simpleRouteJson: {
        traces,
        differentialPairs: [
          { connectionNames: ["P", "N"], lengthTolerance: 0.01 },
        ],
        lengthMatchingGroups: [],
        obstacles: [],
        bounds: { minX: -1, maxX: 6, minY: 0, maxY: 5 },
        layerCount: 2,
      },
    },
  })

  expect(binding.traceBindings).toHaveLength(2)
  expect(binding.solverParams.originalConnections).toHaveLength(2)
  expect(
    binding.solverParams.hdRoutes.some(
      (route) => route.rootConnectionName === "UNTARGETED_P",
    ),
  ).toBe(true)
  expect(
    binding.solverParams.hdRoutes.some(
      (route) =>
        route.rootConnectionName === "SPECIAL" && route.traceThickness === 1.8,
    ),
  ).toBe(true)
  expect(binding.solverParams.obstacleMargin).toBe(1.8)
})
