import type { SegmentCandidate } from "../internal-types"

/** Create a stable identity for a geometry choice on a routed segment. */
export const getRegressionAttemptKey = (
  attempt: Pick<
    SegmentCandidate,
    | "routeIndex"
    | "segmentIndex"
    | "toothCount"
    | "placement"
    | "toothPitch"
    | "leadFraction"
    | "heightProfile"
    | "maximumDepth"
    | "minimumHeight"
  >,
): string =>
  [
    attempt.routeIndex,
    attempt.segmentIndex,
    attempt.toothCount,
    attempt.placement,
    attempt.toothPitch,
    attempt.leadFraction ?? 0.5,
    attempt.heightProfile,
    attempt.maximumDepth,
    attempt.minimumHeight,
  ].join(":")
