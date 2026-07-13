import type {
  PlannedAttemptTarget,
  RegressionAttempt,
  SegmentCandidate,
} from "./internal-types"

/** A quality-ranked selection of same-style meander segments. */
export type PartialMeanderPlan = {
  attempts: RegressionAttempt[]
}

/** Create a stable identity for a geometry choice on a routed segment. */
export const getRegressionAttemptKey = (
  attempt: Pick<
    SegmentCandidate,
    "routeIndex" | "segmentIndex" | "toothCount" | "placement"
  >,
): string =>
  [
    attempt.routeIndex,
    attempt.segmentIndex,
    attempt.toothCount,
    attempt.placement,
  ].join(":")

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
      segmentIndex: attempt.segmentIndex,
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
  const attemptsByStyle = new Map<string, Map<string, RegressionAttempt>>()
  for (const attempt of input.attempts) {
    const segmentKey = `${attempt.routeIndex}:${attempt.segmentIndex}`
    const styleKey = getMeanderStyleKey(attempt)
    const attemptsBySegment = attemptsByStyle.get(styleKey)
    const existingAttempt = attemptsBySegment?.get(segmentKey)
    if (!attemptsBySegment) {
      attemptsByStyle.set(styleKey, new Map([[segmentKey, attempt]]))
      continue
    }
    if (!existingAttempt || attempt.addedLength > existingAttempt.addedLength)
      attemptsBySegment.set(segmentKey, attempt)
  }
  let selectedPlan: PartialMeanderPlan | null = null
  for (const attemptsBySegment of attemptsByStyle.values()) {
    const attempts = [...attemptsBySegment.values()].sort(
      (left, right) => right.addedLength - left.addedLength,
    )
    let availableLength = 0
    for (let index = 0; index < attempts.length; index++) {
      availableLength += attempts[index]!.addedLength
      if (availableLength + input.lengthTolerance < input.targetAddedLength)
        continue
      const plannedAttempts = attempts.slice(0, index + 1)
      const planQualityScore = plannedAttempts.reduce(
        (total, attempt) => total + attempt.qualityScore,
        0,
      )
      if (!selectedPlan) {
        selectedPlan = { attempts: plannedAttempts }
        break
      }
      const selectedPlanQualityScore = selectedPlan.attempts.reduce(
        (total, attempt) => total + attempt.qualityScore,
        0,
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
