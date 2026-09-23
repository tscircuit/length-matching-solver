import { expect, test } from "bun:test"
import { isCandidateGeometryValid } from "../../lib/length-matching/geometry-validation"
import type { HighDensityRoute, Obstacle, RoutePoint } from "../../lib/types"

test("retains existing lead clearance without exempting new meander copper", () => {
  const route: HighDensityRoute = {
    connectionName: "signal",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      { x: -2, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
    ],
    vias: [{ x: -1, y: 0.1 }],
  }
  const meanderPoints: RoutePoint[] = [
    { x: -2, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
  ]
  const obstacle: Obstacle = {
    type: "rect",
    layers: ["top"],
    center: { x: -1, y: 0 },
    width: 0.2,
    height: 0.2,
    connectedTo: [],
  }
  const input = {
    route,
    meanderPoints,
    routedRoutes: [route],
    obstacles: [obstacle],
    bounds: { minX: -3, maxX: 5, minY: -2, maxY: 2 },
    layerCount: 2,
    obstacleMargin: 0.1,
  }
  expect(isCandidateGeometryValid(input)).toBe(true)
  expect(
    isCandidateGeometryValid({
      ...input,
      obstacles: [{ ...obstacle, center: { x: 1, y: 1 } }],
    }),
  ).toBe(false)
  expect(
    isCandidateGeometryValid({
      ...input,
      routedRoutes: [{ ...route, vias: [{ x: 1, y: 1.1 }] }],
    }),
  ).toBe(false)
  expect(
    isCandidateGeometryValid({
      ...input,
      routedRoutes: [
        {
          ...route,
          connectionName: "other",
          vias: [],
          route: [
            { x: 1, y: 0.5, z: 0 },
            { x: 1, y: 1.5, z: 0 },
          ],
        },
      ],
    }),
  ).toBe(false)
  expect(
    isCandidateGeometryValid({
      ...input,
      meanderPoints: meanderPoints.map((point, i) =>
        i === 1 ? { ...point, y: 0.01 } : point,
      ),
    }),
  ).toBe(false)
  expect(
    isCandidateGeometryValid({
      ...input,
      meanderPoints: meanderPoints.map((point) => ({ ...point, z: 1 })),
      obstacles: [{ ...obstacle, layers: ["bottom"] }],
    }),
  ).toBe(false)
})
