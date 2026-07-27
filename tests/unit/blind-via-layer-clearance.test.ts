import { expect, test } from "bun:test"
import { isCandidateGeometryValid } from "../../lib/length-matching/validation/isCandidateGeometryValid"
import type { HighDensityRoute } from "../../lib/types"

test("blind vias only block meanders on layers occupied by their span", () => {
  const route: HighDensityRoute = {
    connectionName: "P",
    traceThickness: 0.2,
    viaDiameter: 0.5,
    route: [
      { x: 0, y: 0, z: 2 },
      { x: 2, y: 0, z: 2 },
    ],
    vias: [],
  }
  const blindVia: HighDensityRoute = {
    connectionName: "OTHER",
    traceThickness: 0.2,
    viaDiameter: 0.5,
    route: [],
    vias: [{ x: 1, y: 0.1, zLayers: [0, 1] }],
  }
  const validateOnLayer = (z: number): boolean =>
    isCandidateGeometryValid({
      route: {
        ...route,
        route: route.route.map((point) => ({ ...point, z })),
      },
      meanderPoints: [
        { x: 0, y: 0, z },
        { x: 2, y: 0, z },
      ],
      routedRoutes: [blindVia],
      obstacles: [],
      layerCount: 4,
      obstacleMargin: 0.2,
    })

  expect(validateOnLayer(2)).toBe(true)
  expect(validateOnLayer(1)).toBe(false)
})
