import { expect, test } from "bun:test"
import { validateCandidateGeometry } from "../../../lib/post-processing/geometry/validateCandidateGeometry"
import { parseSimplifiedPcbTrace } from "../../../lib/post-processing/model/parseSimplifiedPcbTrace"
import type { Obstacle, SimplifiedPcbTrace } from "../../../lib/types"

test("final geometry permits pour antipads without permitting plane wires or pad collisions", () => {
  const positive: SimplifiedPcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "positive-trace",
    connection_name: "positive",
    route: [
      { route_type: "wire", x: -2, y: 0.4, width: 0.1, layer: "top" },
      { route_type: "wire", x: 0, y: 0.4, width: 0.1, layer: "top" },
      {
        route_type: "via",
        x: 0,
        y: 0.4,
        from_layer: "top",
        to_layer: "bottom",
        via_diameter: 0.35,
      },
      { route_type: "wire", x: 0, y: 0.4, width: 0.1, layer: "bottom" },
      { route_type: "wire", x: 2, y: 0.4, width: 0.1, layer: "bottom" },
    ],
  }
  const negative: SimplifiedPcbTrace = {
    ...positive,
    pcb_trace_id: "negative-trace",
    connection_name: "negative",
    route: positive.route.map((point) => ({ ...point, y: -0.4 })),
  }
  const plane: Obstacle = {
    type: "rect",
    isCopperPour: true,
    layers: ["inner1", "inner4"],
    center: { x: 0, y: 0 },
    width: 8,
    height: 6,
    connectedTo: [],
  }
  const context = {
    immutableTraces: [],
    obstacles: [plane],
    bounds: { minX: -5, maxX: 5, minY: -4, maxY: 4 },
    layerCount: 6,
  }
  const first = parseSimplifiedPcbTrace(positive, 6)
  const second = parseSimplifiedPcbTrace(negative, 6)
  expect(validateCandidateGeometry(first, second, context)).toBe(true)
  expect(
    validateCandidateGeometry(first, second, {
      ...context,
      obstacles: [{ ...plane, isCopperPour: false }],
    }),
  ).toBe(false)
  const planeWire = parseSimplifiedPcbTrace(
    {
      ...positive,
      route: [
        { route_type: "wire", x: -2, y: 0.4, width: 0.1, layer: "inner1" },
        { route_type: "wire", x: 2, y: 0.4, width: 0.1, layer: "inner1" },
      ],
    },
    6,
  )
  expect(validateCandidateGeometry(planeWire, second, context)).toBe(false)
  expect(
    validateCandidateGeometry(first, second, {
      ...context,
      obstacles: [
        {
          type: "rect",
          layers: ["top", "inner1", "inner2", "inner3", "inner4", "bottom"],
          center: { x: 0, y: 0.4 },
          width: 0.3,
          height: 0.3,
          connectedTo: [],
        },
      ],
    }),
  ).toBe(false)
})
