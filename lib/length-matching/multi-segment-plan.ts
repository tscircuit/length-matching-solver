import type { RegressionAttempt } from "./internal-types"

/** A capacity-based selection of same-tooth-count meander segments. */
export type PartialMeanderPlan = {
  firstAttempt: RegressionAttempt
  segmentCount: number
}

/** Choose the fewest same-tooth-count segments that can supply the target length. */
export const selectPartialMeanderPlan = (input: {
  attempts: RegressionAttempt[]
  targetAddedLength: number
  lengthTolerance: number
}): PartialMeanderPlan | null => {
  const attemptsByToothCount = new Map<number, Map<string, RegressionAttempt>>()
  for (const attempt of input.attempts) {
    const attemptsBySegment = attemptsByToothCount.get(attempt.toothCount)
    const segmentKey = `${attempt.routeIndex}:${attempt.segmentIndex}`
    const existingAttempt = attemptsBySegment?.get(segmentKey)
    if (!attemptsBySegment) {
      attemptsByToothCount.set(
        attempt.toothCount,
        new Map([[segmentKey, attempt]]),
      )
    } else if (
      !existingAttempt ||
      attempt.addedLength > existingAttempt.addedLength
    ) {
      attemptsBySegment.set(segmentKey, attempt)
    }
  }
  let selectedPlan: PartialMeanderPlan | null = null
  for (const attemptsBySegment of attemptsByToothCount.values()) {
    const attempts = [...attemptsBySegment.values()].sort(
      (left, right) => right.addedLength - left.addedLength,
    )
    let availableLength = 0
    for (let index = 0; index < attempts.length; index++) {
      availableLength += attempts[index]!.addedLength
      if (availableLength + input.lengthTolerance < input.targetAddedLength)
        continue
      const plannedAttempts = attempts.slice(0, index + 1)
      const firstAttempt = plannedAttempts.reduce((rightmost, attempt) =>
        attempt.segmentIndex > rightmost.segmentIndex ? attempt : rightmost,
      )
      if (
        !selectedPlan ||
        plannedAttempts.length < selectedPlan.segmentCount ||
        (plannedAttempts.length === selectedPlan.segmentCount &&
          firstAttempt.toothCount < selectedPlan.firstAttempt.toothCount)
      )
        selectedPlan = { firstAttempt, segmentCount: plannedAttempts.length }
      break
    }
  }
  return selectedPlan
}
