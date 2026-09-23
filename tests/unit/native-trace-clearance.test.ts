import { expect, test } from "bun:test"
import { validateAndResolveParams } from "../../lib/length-matching/validation/validateAndResolveParams"
import { isCandidateGeometryValid } from "../../lib/length-matching/validation/isCandidateGeometryValid"
import type { HighDensityRoute, SimplifiedPcbTrace } from "../../lib/types"

test("checks native diagonal wires, round end caps, widths, and blind via spans", (): void => {
  const trace: SimplifiedPcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "fixed",
    connection_name: "P",
    route: [
      { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.2 },
      { route_type: "wire", x: 4, y: 4, layer: "top", width: 0.2 },
      {
        route_type: "via",
        x: 4,
        y: 4,
        from_layer: "top",
        to_layer: "inner1",
        via_diameter: 0.8,
      },
      { route_type: "wire", x: 4, y: 4, layer: "inner1", width: 0.2 },
      { route_type: "wire", x: 5, y: 4, layer: "inner1", width: 0.6 },
    ],
  }
  const config = validateAndResolveParams({
    hdRoutes: [],
    originalConnections: [],
    traces: [trace],
    layerCount: 4,
    obstacleMargin: 0.1,
  })
  const clearanceCases = [
    { x: 0, y: 3, z: 0, isValid: true }, // Inside the bounding box, far from copper.
    { x: 2, y: 2, z: 0, isValid: false },
    { x: -0.25, y: 0, z: 0, isValid: false }, // Rounded wire cap.
    { x: -0.5, y: 0, z: 0, isValid: true },
    { x: 4, y: 4.5, z: 1, isValid: false }, // Via radius, not wire width.
    { x: 4, y: 4.5, z: 2, isValid: true }, // Outside the blind via span.
    { x: 4.8, y: 4.4, z: 1, isValid: false }, // Wider wire segment.
    { x: 4.8, y: 4.7, z: 1, isValid: true },
  ]
  for (const { x, y, z, isValid } of clearanceCases) {
    const route: HighDensityRoute = {
      connectionName: "P",
      traceThickness: 0.2,
      viaDiameter: 0.4,
      route: [
        { x, y, z },
        { x: x + 0.05, y, z },
      ],
      vias: [],
    }
    expect(
      isCandidateGeometryValid({
        ...config,
        route,
        meanderPoints: route.route,
        routedRoutes: [],
      }),
    ).toBe(isValid)
  }
  trace.route[0] = {
    route_type: "wire",
    x: NaN,
    y: 0,
    layer: "top",
    width: 0.2,
  }
  expect(() =>
    validateAndResolveParams({
      hdRoutes: [],
      originalConnections: [],
      traces: [trace],
    }),
  ).toThrow("invalid wire")
})
