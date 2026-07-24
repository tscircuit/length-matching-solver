import type { MinimumAttempt, MinimumAttemptPlan } from "../dual-meander-plan"
import { getMeanderPlanQualityScore } from "./getMeanderPlanQualityScore"

export const getDualMeanderAttemptPlans = (
  minimumAttempts: MinimumAttempt[],
): MinimumAttemptPlan[] => {
  const getMinimumAttemptStyleKey = (minimumAttempt: MinimumAttempt): string =>
    [
      minimumAttempt.candidate.toothCount,
      minimumAttempt.candidate.placement,
      minimumAttempt.candidate.heightProfile,
    ].join(":")
  const attemptsByStyle = new Map<string, Map<string, MinimumAttempt[]>>()
  for (const minimumAttempt of minimumAttempts) {
    const styleKey = getMinimumAttemptStyleKey(minimumAttempt)
    const segmentKey = `${minimumAttempt.candidate.routeIndex}:${minimumAttempt.candidate.segmentIndex}`
    const attemptsBySegment = attemptsByStyle.get(styleKey)
    if (!attemptsBySegment) {
      attemptsByStyle.set(styleKey, new Map([[segmentKey, [minimumAttempt]]]))
      continue
    }
    const segmentAttempts = attemptsBySegment.get(segmentKey)
    if (segmentAttempts) segmentAttempts.push(minimumAttempt)
    else attemptsBySegment.set(segmentKey, [minimumAttempt])
  }
  const plans: MinimumAttemptPlan[] = []
  for (const attemptsBySegment of attemptsByStyle.values()) {
    const segmentOptions = [...attemptsBySegment.values()]
      .map((attempts) => ({
        attempts,
        maximumAddedLength: Math.max(
          ...attempts.map((attempt) => attempt.attempt.maximumAddedLength),
        ),
        minimumAddedLength: Math.min(
          ...attempts.map((attempt) => attempt.attempt.addedLength),
        ),
        rankingAttempt: attempts.reduce((bestAttempt, attempt) =>
          attempt.attempt.qualityScore > bestAttempt.attempt.qualityScore
            ? attempt
            : bestAttempt,
        ),
      }))
      .sort((left, right) => right.maximumAddedLength - left.maximumAddedLength)
    for (const segmentOption of segmentOptions) {
      plans.push({
        attempts: [segmentOption.rankingAttempt],
        attemptOptions: [segmentOption.attempts],
        minimumAddedLength: segmentOption.minimumAddedLength,
        maximumAddedLength: segmentOption.maximumAddedLength,
        rankingQualityScore: segmentOption.rankingAttempt.attempt.qualityScore,
      })
    }
    for (
      let segmentCount = 2;
      segmentCount <= segmentOptions.length;
      segmentCount++
    ) {
      const selectedOptions = segmentOptions.slice(0, segmentCount)
      const attempts = selectedOptions.map((options) => options.rankingAttempt)
      plans.push({
        attempts,
        attemptOptions: selectedOptions.map((options) => options.attempts),
        minimumAddedLength: selectedOptions.reduce(
          (total, options) => total + options.minimumAddedLength,
          0,
        ),
        maximumAddedLength: selectedOptions.reduce(
          (total, options) => total + options.maximumAddedLength,
          0,
        ),
        rankingQualityScore: getMeanderPlanQualityScore(
          attempts.map((attempt) => attempt.attempt),
        ),
      })
    }
  }
  return plans
}
