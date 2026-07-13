import { expect, test } from "bun:test"
import { evaluateMeanderCandidate } from "../lib/length-matching/meander-candidate"
import type { HighDensityRoute } from "../lib/types"

test("fits a feasible curved meander when linear regression overestimates its scale", () => {
  const route: HighDensityRoute = {
    connectionName: "short-route",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    vias: [],
    route: [
      { x: 0, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
    ],
  }

  const attempt = evaluateMeanderCandidate({
    candidate: {
      routeIndex: 0,
      segmentIndex: 0,
      segmentLength: 20,
      toothCount: 1,
      maximumDepth: 1,
      toothPitch: 1,
      placement: "negative",
    },
    route,
    connectionName: route.connectionName,
    targetAddedLength: 1.4278766054,
    lengthTolerance: 0.001,
    isGeometryValid: () => true,
  })

  expect(attempt.valid).toBe(true)
  expect(attempt.predictedScaleFactor).toBeCloseTo(1, 6)
  expect(attempt.resultingError).toBeLessThan(0.001)
})
