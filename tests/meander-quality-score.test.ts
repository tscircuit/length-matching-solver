import { expect, test } from "bun:test"
import { evaluateMeanderCandidate } from "../lib/length-matching/meander-candidate"
import type {
  MeanderHeightProfile,
  MeanderPlacement,
  RegressionAttempt,
} from "../lib/length-matching/internal-types"
import type { HighDensityRoute } from "../lib/types"

test("prefers broad distributed meanders over concentrated or compact alternatives", () => {
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
  const evaluate = (input: {
    toothCount: number
    toothPitch: number
    placement: MeanderPlacement
    heightProfile: MeanderHeightProfile
  }): RegressionAttempt =>
    evaluateMeanderCandidate({
      candidate: {
        routeIndex: 0,
        span: {
          startIndex: 0,
          endIndex: 1,
          length: 20,
          traceThickness: 0.15,
        },
        toothCount: input.toothCount,
        maximumDepth: 5,
        minimumHeight: 0.1,
        toothPitch: input.toothPitch,
        placement: input.placement,
        heightProfile: input.heightProfile,
      },
      route,
      connectionName: route.connectionName,
      targetAddedLength: 3,
      lengthTolerance: 0.001,
      isGeometryValid: () => true,
    })
  const concentratedAttempt = evaluate({
    toothCount: 1,
    toothPitch: 2,
    placement: "negative",
    heightProfile: "uniform",
  })
  const compactAttempt = evaluate({
    toothCount: 2,
    toothPitch: 2,
    placement: "balanced",
    heightProfile: "tapered",
  })
  const relaxedAttempt = evaluate({
    toothCount: 2,
    toothPitch: 4,
    placement: "balanced",
    heightProfile: "tapered",
  })

  expect(concentratedAttempt.valid).toBe(true)
  expect(compactAttempt.valid).toBe(true)
  expect(relaxedAttempt.valid).toBe(true)
  expect(relaxedAttempt.qualityScore).toBeGreaterThan(
    concentratedAttempt.qualityScore,
  )
  expect(relaxedAttempt.qualityScore).toBeGreaterThan(
    compactAttempt.qualityScore,
  )
})
