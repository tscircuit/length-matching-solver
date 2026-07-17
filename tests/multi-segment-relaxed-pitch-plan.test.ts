import { expect, test } from "bun:test"
import type { RegressionAttempt } from "../lib/length-matching/internal-types"
import { selectPartialMeanderPlan } from "../lib/length-matching/multi-segment-plan"

test("selects relaxed pitch variants when they can supply a multi-segment plan", () => {
  const createAttempt = (input: {
    segmentIndex: number
    toothPitch: number
    addedLength: number
    qualityScore: number
  }): RegressionAttempt => ({
    routeIndex: 0,
    span: {
      startIndex: input.segmentIndex,
      endIndex: input.segmentIndex + 1,
      length: 10,
      traceThickness: 0.15,
    },
    toothCount: 2,
    maximumDepth: 5,
    minimumHeight: 0.1,
    toothPitch: input.toothPitch,
    placement: "balanced",
    heightProfile: "tapered",
    connectionName: "short-route",
    maximumToothDepths: [5, 5],
    sampleScaleFactors: [0.25, 0.75],
    sampleAddedLengths: [1, 2],
    slope: 2,
    intercept: 0,
    predictedScaleFactor: 1,
    predictedToothDepths: [1, 1],
    predictedRoute: [],
    addedLength: input.addedLength,
    resultingError: 0,
    testedSegment: [
      { x: input.segmentIndex * 10, y: 0, z: 0 },
      { x: (input.segmentIndex + 1) * 10, y: 0, z: 0 },
    ],
    meanderPoints: [],
    qualityScore: input.qualityScore,
    valid: true,
  })
  const attempts = [0, 1].flatMap((segmentIndex) => [
    createAttempt({
      segmentIndex,
      toothPitch: 4,
      addedLength: 3,
      qualityScore: 90,
    }),
    createAttempt({
      segmentIndex,
      toothPitch: 1,
      addedLength: 5,
      qualityScore: 40,
    }),
  ])

  const plan = selectPartialMeanderPlan({
    attempts,
    targetAddedLength: 6,
    lengthTolerance: 0.001,
  })

  expect(plan?.attempts).toHaveLength(2)
  expect(plan?.attempts.every((attempt) => attempt.toothPitch === 4)).toBe(true)
})
