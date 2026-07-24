import type {
  PlannedAttemptTarget,
  RegressionAttempt,
  SegmentCandidate,
} from "./internal-types"

/** A quality-ranked selection of same-style meander segments. */
export type PartialMeanderPlan = {
  attempts: RegressionAttempt[]
}

type SegmentPitchOptions = {
  attempts: RegressionAttempt[]
  maximumCapacityAttempt: RegressionAttempt
}

const ADDITIONAL_SEGMENT_PENALTY = 3

/** Compare plans without allowing extra segments to inflate a summed score. */
export const getMeanderPlanQualityScore = (
  attempts: Pick<RegressionAttempt, "qualityScore">[],
): number => {
  if (attempts.length === 0)
    throw new Error("LengthMatchingSolver: cannot score an empty meander plan")
  const meanQuality =
    attempts.reduce((total, attempt) => total + attempt.qualityScore, 0) /
    attempts.length
  return meanQuality - ADDITIONAL_SEGMENT_PENALTY * (attempts.length - 1)
}

/** Create a stable identity for a geometry choice on a routed segment. */
export const getRegressionAttemptKey = (
  attempt: Pick<
    SegmentCandidate,
    | "routeIndex"
    | "span"
    | "toothCount"
    | "placement"
    | "toothPitch"
    | "heightProfile"
    | "maximumDepth"
    | "minimumHeight"
  >,
): string =>
  [
    attempt.routeIndex,
    attempt.span.startIndex,
    attempt.span.endIndex,
    attempt.toothCount,
    attempt.placement,
    attempt.toothPitch,
    attempt.heightProfile,
    attempt.maximumDepth,
    attempt.minimumHeight,
  ].join(":")

// Pitch is selected per segment after target allocation, so unequal segment
// lengths can still participate in one tooth-count/profile plan.
const getMeanderStyleKey = (attempt: SegmentCandidate): string =>
  [attempt.toothCount, attempt.placement, attempt.heightProfile].join(":")

/** Divide a target across selected attempts without exceeding their capacities. */
export const getPlannedAttemptTargets = (input: {
  attempts: RegressionAttempt[]
  targetAddedLength: number
}): Map<string, PlannedAttemptTarget> => {
  const targets = new Map<string, PlannedAttemptTarget>()
  const attempts = [...input.attempts].sort(
    (left, right) => left.addedLength - right.addedLength,
  )
  let remainingLength = input.targetAddedLength
  for (let index = 0; index < attempts.length; index++) {
    const attempt = attempts[index]!
    const target = Math.min(
      attempt.addedLength,
      remainingLength / (attempts.length - index),
    )
    targets.set(getRegressionAttemptKey(attempt), {
      routeIndex: attempt.routeIndex,
      span: attempt.span,
      targetAddedLength: target,
    })
    remainingLength -= target
  }
  return targets
}

/** Choose the fewest same-style segment choices that can supply the target. */
export const selectPartialMeanderPlan = (input: {
  attempts: RegressionAttempt[]
  targetAddedLength: number
  lengthTolerance: number
}): PartialMeanderPlan | null => {
  const attemptsByStyle = new Map<string, Map<string, RegressionAttempt[]>>()
  for (const attempt of input.attempts) {
    const segmentKey = `${attempt.routeIndex}:${attempt.span.startIndex}:${attempt.span.endIndex}`
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
            `LengthMatchingSolver: no pitch can supply planned target for route ${options.maximumCapacityAttempt.routeIndex} span ${options.maximumCapacityAttempt.span.startIndex}-${options.maximumCapacityAttempt.span.endIndex}`,
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
