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
      { route_type: "via", x: 4, y: 4, from_layer: "top", to_layer: "inner1", via_diameter: 0.8 },
      { route_type: "wire", x: 4, y: 4, layer: "inner1", width: 0.2 },
      { route_type: "wire", x: 5, y: 4, layer: "inner1", width: 0.6 },
    ],
  }
  const config = validateAndResolveParams({ hdRoutes: [], originalConnections: [], traces: [trace], layerCount: 4, obstacleMargin: 0.1 })
  const valid = (x: number, y: number, z: number): boolean => {
    const route: HighDensityRoute = {
      connectionName: "P", traceThickness: 0.2, viaDiameter: 0.4,
      route: [{ x, y, z }, { x: x + 0.05, y, z }], vias: [],
    }
    return isCandidateGeometryValid({ ...config, route, meanderPoints: route.route, routedRoutes: [] })
  }
  expect(valid(0, 3, 0)).toBe(true) // Inside the diagonal's bounding box, far from copper.
  expect(valid(2, 2, 0)).toBe(false)
  expect(valid(-0.25, 0, 0)).toBe(false) // Rounded wire cap.
  expect(valid(-0.5, 0, 0)).toBe(true)
  expect(valid(4, 4.5, 1)).toBe(false) // Via radius, not wire width.
  expect(valid(4, 4.5, 2)).toBe(true) // Outside the blind via span.
  expect(valid(4.8, 4.4, 1)).toBe(false) // Wider wire segment.
  expect(valid(4.8, 4.7, 1)).toBe(true)
  trace.route[0] = { route_type: "wire", x: NaN, y: 0, layer: "top", width: 0.2 }
  expect(() => validateAndResolveParams({ hdRoutes: [], originalConnections: [], traces: [trace] })).toThrow("invalid wire")
})
