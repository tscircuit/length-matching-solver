import { expect, test } from "bun:test"
import { getMeanderPlanQualityScore } from "../../lib/length-matching/multi-segment-plan"

test("allows materially gentler distributed plans without rewarding fragmentation", () => {
  const deepSingleSegmentScore = getMeanderPlanQualityScore([
    { qualityScore: 60 },
  ])
  const gentleDistributedScore = getMeanderPlanQualityScore([
    { qualityScore: 80 },
    { qualityScore: 80 },
  ])
  const marginalDistributedScore = getMeanderPlanQualityScore([
    { qualityScore: 82 },
    { qualityScore: 82 },
  ])

  expect(gentleDistributedScore).toBeGreaterThan(deepSingleSegmentScore)
  expect(getMeanderPlanQualityScore([{ qualityScore: 80 }])).toBeGreaterThan(
    marginalDistributedScore,
  )
})
