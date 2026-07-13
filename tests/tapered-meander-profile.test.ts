import { expect, test } from "bun:test"
import { evaluateMeanderCandidate } from "../lib/length-matching/meander-candidate"
import type { HighDensityRoute } from "../lib/types"

test("fits a tapered height envelope within one multi-tooth segment", () => {
  const route: HighDensityRoute = {
    connectionName: "short-route",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    vias: [],
    route: [
      { x: 0, y: 0, z: 0 },
      { x: 12, y: 0, z: 0 },
    ],
  }
  const attempt = evaluateMeanderCandidate({
    candidate: {
      routeIndex: 0,
      segmentIndex: 0,
      segmentLength: 12,
      toothCount: 3,
      maximumDepth: 2,
      minimumHeight: 0.1,
      toothPitch: 1,
      placement: "balanced",
      heightProfile: "tapered",
    },
    route,
    connectionName: route.connectionName,
    targetAddedLength: 3,
    lengthTolerance: 0.001,
    isGeometryValid: () => true,
  })

  expect(attempt.valid).toBe(true)
  expect(attempt.predictedToothDepths[0]!).toBeLessThan(
    attempt.predictedToothDepths[1]!,
  )
  expect(attempt.predictedToothDepths[0]).toBeCloseTo(
    attempt.predictedToothDepths[2]!,
    6,
  )
})
