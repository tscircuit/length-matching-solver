import type { RegressionAttempt, SegmentCandidate } from "../internal-types"
import { getMeanderPlanQualityScore } from "./getMeanderPlanQualityScore"
import { getPlannedAttemptTargets } from "./getPlannedAttemptTargets"
import { getRegressionAttemptKey } from "./getRegressionAttemptKey"

/** A quality-ranked selection of same-style meander segments. */
export type PartialMeanderPlan = {
  attempts: RegressionAttempt[]
}

type SegmentPitchOptions = {
  attempts: RegressionAttempt[]
  maximumCapacityAttempt: RegressionAttempt
}

/** Choose the fewest same-style segment choices that can supply the target. */
export const selectPartialMeanderPlan = (input: {
  attempts: RegressionAttempt[]
  targetAddedLength: number
  lengthTolerance: number
}): PartialMeanderPlan | null => {
  const getMeanderStyleKey = (attempt: SegmentCandidate): string =>
    [attempt.toothCount, attempt.placement, attempt.heightProfile].join(":")
  const attemptsByStyle = new Map<string, Map<string, RegressionAttempt[]>>()
  for (const attempt of input.attempts) {
    const segmentKey = `${attempt.routeIndex}:${attempt.segmentIndex}`
    const styleKey = getMeanderStyleKey(attempt)
    const attemptsBySegment = attemptsByStyle.get(styleKey)
    if (!attemptsBySegment) {
      attemptsByStyle.set(styleKey, new Map([[segmentKey, [attempt]]]))
      continue
    }
    const segmentAttempts = attemptsBySegment.get(segmentKey)
    if (!segmentAttempts) attemptsBySegment.set(segmentKey, [attempt])
    else segmentAttempts.push(attempt)
  }
  let selectedPlan: PartialMeanderPlan | null = null
  for (const attemptsBySegment of attemptsByStyle.values()) {
    const segmentPitchOptions: SegmentPitchOptions[] = [
      ...attemptsBySegment.values(),
    ]
      .map((attempts) => ({
        attempts,
        maximumCapacityAttempt: attempts.reduce((bestAttempt, attempt) =>
          attempt.addedLength > bestAttempt.addedLength ? attempt : bestAttempt,
        ),
      }))
      .sort(
        (left, right) =>
          right.maximumCapacityAttempt.addedLength -
          left.maximumCapacityAttempt.addedLength,
      )
    let availableLength = 0
    for (let index = 0; index < segmentPitchOptions.length; index++) {
      availableLength +=
        segmentPitchOptions[index]!.maximumCapacityAttempt.addedLength
      if (availableLength + input.lengthTolerance < input.targetAddedLength)
        continue
      const selectedSegmentOptions = segmentPitchOptions.slice(0, index + 1)
      const capacityAttempts = selectedSegmentOptions.map(
        (options) => options.maximumCapacityAttempt,
      )
      const capacityTargets = getPlannedAttemptTargets({
        attempts: capacityAttempts,
        targetAddedLength: input.targetAddedLength,
      })
      const plannedAttempts = selectedSegmentOptions.map((options) => {
        const maximumCapacityTarget = capacityTargets.get(
          getRegressionAttemptKey(options.maximumCapacityAttempt),
        )
        if (!maximumCapacityTarget)
          throw new Error(
            `LengthMatchingSolver: missing capacity target for ${getRegressionAttemptKey(options.maximumCapacityAttempt)}`,
          )
        const feasibleAttempts = options.attempts.filter(
          (attempt) =>
            attempt.addedLength + input.lengthTolerance >=
            maximumCapacityTarget.targetAddedLength,
        )
        if (feasibleAttempts.length === 0)
          throw new Error(
            `LengthMatchingSolver: no pitch can supply planned target for route ${options.maximumCapacityAttempt.routeIndex} segment ${options.maximumCapacityAttempt.segmentIndex}`,
          )
        return feasibleAttempts.reduce((bestAttempt, attempt) =>
          attempt.qualityScore > bestAttempt.qualityScore ||
          (attempt.qualityScore === bestAttempt.qualityScore &&
            attempt.toothPitch > bestAttempt.toothPitch)
            ? attempt
            : bestAttempt,
        )
      })
      const planQualityScore = getMeanderPlanQualityScore(plannedAttempts)
      if (!selectedPlan) {
        selectedPlan = { attempts: plannedAttempts }
        break
      }
      const selectedPlanQualityScore = getMeanderPlanQualityScore(
        selectedPlan.attempts,
      )
      if (
        plannedAttempts.length < selectedPlan.attempts.length ||
        (plannedAttempts.length === selectedPlan.attempts.length &&
          planQualityScore > selectedPlanQualityScore)
      )
        selectedPlan = { attempts: plannedAttempts }
      break
    }
  }
  return selectedPlan
}
