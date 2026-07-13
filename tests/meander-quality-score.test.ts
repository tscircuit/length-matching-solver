import { expect, test } from "bun:test"
import { getMeanderQualityScore } from "../lib/length-matching/meander-quality"

test("prefers a single lobe over multi-lobe or uneven alternatives", () => {
  const singleLobeScore = getMeanderQualityScore({
    addedLength: 4,
    predictedToothDepths: [1.35],
    segmentLength: 20,
    toothCount: 1,
    toothPitch: 2,
    heightProfile: "uniform",
  })
  const shallowEvenScore = getMeanderQualityScore({
    addedLength: 4,
    predictedToothDepths: [0.4, 0.4],
    segmentLength: 20,
    toothCount: 2,
    toothPitch: 2,
    heightProfile: "uniform",
  })
  const tallScore = getMeanderQualityScore({
    addedLength: 4,
    predictedToothDepths: [3, 3],
    segmentLength: 20,
    toothCount: 2,
    toothPitch: 2,
    heightProfile: "uniform",
  })
  const unevenScore = getMeanderQualityScore({
    addedLength: 4,
    predictedToothDepths: [0.1, 2],
    segmentLength: 20,
    toothCount: 2,
    toothPitch: 2,
    heightProfile: "uniform",
  })

  expect(shallowEvenScore).toBeGreaterThan(tallScore)
  expect(shallowEvenScore).toBeGreaterThan(unevenScore)
  expect(singleLobeScore).toBeGreaterThan(shallowEvenScore)
  expect(tallScore).toBeGreaterThanOrEqual(0)
})
