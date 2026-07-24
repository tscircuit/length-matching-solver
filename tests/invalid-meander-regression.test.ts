import { expect, test } from "bun:test"
import { evaluateMeanderCandidate } from "../lib/length-matching/meander-candidate"
import type { HighDensityRoute } from "../lib/types"

test("rejects a non-positive regression prediction without invalid geometry", () => {
  const route: HighDensityRoute = {
    connectionName: "short-route",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    vias: [],
    route: [
      { x: 0, y: 0, z: 0 },
      { x: 6, y: 0, z: 0 },
    ],
  }

  const attempt = evaluateMeanderCandidate({
    candidate: {
      routeIndex: 0,
      span: {
        startIndex: 0,
        endIndex: 1,
        length: 6,
        traceThickness: 0.15,
      },
      toothCount: 1,
      maximumDepth: 2,
      minimumHeight: 0.01,
      toothPitch: 1,
      placement: "negative",
      heightProfile: "uniform",
    },
    route,
    connectionName: route.connectionName,
    targetAddedLength: -1,
    lengthTolerance: 0.001,
    isGeometryValid: () => true,
  })

  expect(attempt.valid).toBe(false)
  expect(attempt.predictedScaleFactor).toBeLessThan(0)
  expect(
    attempt.predictedRoute.every(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    ),
  ).toBe(true)
})
