import { expect, test } from "bun:test"
import type { HighDensityRoute } from "../../../lib"
import { isCandidateGeometryValid } from "../../../lib/length-matching/geometry-validation"

test("rejects meanders that detach an immutable same-root tap endpoint", (): void => {
  const route: HighDensityRoute = {
    connectionName: "P:0",
    rootConnectionName: "P_NET",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    route: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
    vias: [],
  }
  const tap: HighDensityRoute = {
    ...route,
    connectionName: "P_TAP",
    route: [{ x: 5, y: 0, z: 0 }, { x: 5, y: -2, z: 0 }],
  }
  const input = {
    route,
    routedRoutes: [route, tap],
    obstacles: [],
    layerCount: 2,
    obstacleMargin: 0.15,
  }
  expect(isCandidateGeometryValid({
    ...input,
    meanderPoints: [
      { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 },
      { x: 10, y: 1, z: 0 }, { x: 10, y: 0, z: 0 },
    ],
  })).toBe(false)
  expect(isCandidateGeometryValid({
    ...input,
    meanderPoints: [
      { x: 0, y: 0, z: 0 }, { x: 6, y: 0, z: 0 },
      { x: 6, y: 1, z: 0 }, { x: 9, y: 1, z: 0 },
      { x: 9, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },
    ],
  })).toBe(true)
})
