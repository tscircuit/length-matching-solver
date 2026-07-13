import { expect, test } from "bun:test"
import { getMeanderQualityScore } from "../lib/length-matching/meander-quality"

test("ranks shallow and even meanders above tall or uneven alternatives", () => {
  const shallowEvenScore = getMeanderQualityScore({
    addedLength: 4,
    predictedToothDepths: [0.4, 0.4],
    segmentLength: 20,
    toothCount: 2,
    toothPitch: 2,
  })
  const tallScore = getMeanderQualityScore({
    addedLength: 4,
    predictedToothDepths: [3, 3],
    segmentLength: 20,
    toothCount: 2,
    toothPitch: 2,
  })
  const unevenScore = getMeanderQualityScore({
    addedLength: 4,
    predictedToothDepths: [0.1, 2],
    segmentLength: 20,
    toothCount: 2,
    toothPitch: 2,
  })

  expect(shallowEvenScore).toBeGreaterThan(tallScore)
  expect(shallowEvenScore).toBeGreaterThan(unevenScore)
  expect(tallScore).toBeGreaterThanOrEqual(0)
})
