import type {
  PlannedAttemptTarget,
  RegressionAttempt,
} from "../internal-types"
import { getRegressionAttemptKey } from "./getRegressionAttemptKey"

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
