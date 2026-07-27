import { expect, test } from "bun:test"
import { createSearchGeometryValidator } from "../../../lib/post-processing/geometry/createSearchGeometryValidator"

test("checks search vias on the local spine normal with real diameters and z-layer copper", () => {
  const base = {
    immutableTraces: [],
    bounds: { minX: 0, maxX: 10, minY: -3, maxY: 3 },
    layerCount: 2,
    start: { x: 1, y: 0, layer: "top" },
    end: { x: 9, y: 0, layer: "bottom" },
    firstConnectionName: "P",
    secondConnectionName: "N",
    firstStartTerminal: { x: 1, y: 1.5 },
    firstEndTerminal: { x: 9, y: 1.5 },
    secondStartTerminal: { x: 1, y: -1.5 },
    secondEndTerminal: { x: 9, y: -1.5 },
    firstWidth: 0.2,
    secondWidth: 0.2,
    firstViaDiameter: 0.6,
    secondViaDiameter: 0.4,
    centerlineSpacing: 3,
    side: 1 as const,
  }
  const directional = createSearchGeometryValidator({
    ...base,
    obstacles: [{
      type: "rect",
      layers: [],
      zLayers: [0, 1],
      center: { x: 6.5, y: 0 },
      width: 0.1,
      height: 0.1,
      connectedTo: [],
    }],
  })
  expect(directional.isViaValid(
    { x: 5, y: 0, layer: "top" },
    "bottom",
    { x: 1, y: 0 },
  )).toBe(true)

  const zLayerBlocked = createSearchGeometryValidator({
    ...base,
    immutableTraces: [],
    obstacles: [{
      type: "rect",
      layers: [],
      zLayers: [1],
      center: { x: 5, y: 1.5 },
      width: 0.1,
      height: 0.1,
      connectedTo: [],
    }],
  })
  expect(zLayerBlocked.isViaValid(
    { x: 5, y: 0, layer: "top" },
    "bottom",
    { x: 1, y: 0 },
  )).toBe(false)

  const immutable = createSearchGeometryValidator({
    ...base,
    obstacles: [],
    immutableTraces: [{
      type: "pcb_trace",
      pcb_trace_id: "blocker",
      connection_name: "OTHER",
      route: [
        { route_type: "wire", x: 5, y: 1.5, width: 0.2, layer: "top" },
        { route_type: "wire", x: 5, y: 2.5, width: 0.2, layer: "top" },
      ],
    }],
  })
  expect(immutable.isViaValid(
    { x: 5, y: 0, layer: "top" },
    "bottom",
    { x: 1, y: 0 },
  )).toBe(false)
})
