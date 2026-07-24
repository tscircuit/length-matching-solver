import { expect, test } from "bun:test"
import { isCandidateGeometryValid } from "../lib/length-matching/geometry-validation"
import type { HighDensityRoute } from "../lib"

test("rejects a meander crossing untouched geometry on its own route", (): void => {
  const route: HighDensityRoute = {
    connectionName: "short",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    vias: [],
    route: [
      ...Array.from({ length: 6 }, (_, x) => ({ x, y: 0, z: 0 })),
      { x: 5, y: -1, z: 0 },
      ...[4, 3, 2, 1, 0].map((x) => ({ x, y: -1, z: 0 })),
    ],
  }

  expect(
    isCandidateGeometryValid({
      route,
      span: {
        startIndex: 0,
        endIndex: 5,
        length: 5,
        traceThickness: 0.15,
      },
      meanderPoints: [
        { x: 0, y: 0, z: 0 },
        { x: 2, y: -2, z: 0 },
        { x: 4, y: 0, z: 0 },
        { x: 5, y: 0, z: 0 },
      ],
      routedRoutes: [route],
      obstacles: [],
      bounds: { minX: -2, maxX: 15, minY: -5, maxY: 12 },
      layerCount: 2,
      obstacleMargin: 0.1,
    }),
  ).toBe(false)
})
