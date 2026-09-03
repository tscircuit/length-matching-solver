import { expect, test } from "bun:test"
import { validateCandidateGeometry } from "../../lib/post-processing/geometry/validateCandidateGeometry"
import { parseSimplifiedPcbTrace } from "../../lib/post-processing/model/parseSimplifiedPcbTrace"
import type { Obstacle, SimplifiedPcbTrace } from "../../lib/types"

test("allows clearance to a connected pad without allowing copper overlap or unrelated pads", () => {
  const first: SimplifiedPcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "positive",
    connection_name: "positive",
    route: [
      { route_type: "wire", x: -3, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: -3, y: 0.65, width: 0.2, layer: "top" },
      { route_type: "wire", x: 3, y: 0.65, width: 0.2, layer: "top" },
    ],
  }
  const second = parseSimplifiedPcbTrace(
    {
    type: "pcb_trace",
    pcb_trace_id: "negative",
    connection_name: "negative",
    route: [
      { route_type: "wire", x: -3, y: -2, width: 0.2, layer: "top" },
      { route_type: "wire", x: 3, y: -2, width: 0.2, layer: "top" },
    ],
    },
    2,
  )
  const pad: Obstacle = {
    type: "rect",
    center: { x: -3, y: 0 },
    width: 1,
    height: 1,
    layers: ["top"],
    connectedTo: ["positive"],
  }
  const context = {
    immutableTraces: [],
    obstacles: [pad],
    bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5 },
    layerCount: 2,
  }
  expect(
    validateCandidateGeometry(parseSimplifiedPcbTrace(first, 2), second, context),
  ).toBe(true)

  const overlapping = structuredClone(first)
  for (const point of overlapping.route.slice(1)) {
    if (point.route_type === "wire") point.y = 0.55
  }
  expect(
    validateCandidateGeometry(
      parseSimplifiedPcbTrace(overlapping, 2),
      second,
      context,
    ),
  ).toBe(false)

  expect(
    validateCandidateGeometry(parseSimplifiedPcbTrace(first, 2), second, {
      ...context,
      obstacles: [
        pad,
        { ...pad, center: { x: 0, y: 0 }, connectedTo: ["unrelated"] },
      ],
    }),
  ).toBe(false)
})
