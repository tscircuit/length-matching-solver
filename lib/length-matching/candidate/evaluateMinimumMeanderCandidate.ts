import { getRouteLength } from "../../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../../types"
import type {
  MeanderHeightProfile,
  SegmentCandidate,
  ValidRegressionAttempt,
} from "../internal-types"
import { createMeanderReplacement } from "./createMeanderReplacement"
import { evaluateMeanderCandidate } from "./evaluateMeanderCandidate"
import { replaceSegmentWithMeander } from "./replaceSegmentWithMeander"

const DEPTH_SEARCH_ITERATIONS = 32

/** Evaluate the shallowest minimum-height profile, or return null if rejected. */
export const evaluateMinimumMeanderCandidate = (input: {
  candidate: SegmentCandidate
  route: HighDensityRoute
  connectionName: string
  lengthTolerance: number
  isGeometryValid: (meanderPoints: RoutePoint[]) => boolean
}): ValidRegressionAttempt | null => {
  const getToothHeightWeights = (profile: {
    toothCount: number
    heightProfile: MeanderHeightProfile
  }): number[] => {
    if (profile.heightProfile !== "tapered")
      return Array<number>(profile.toothCount).fill(1)
    const weights = Array.from(
      { length: profile.toothCount },
      (_, toothIndex) =>
        Math.sin((Math.PI * (toothIndex + 1)) / (profile.toothCount + 1)),
    )
    const maximumWeight = Math.max(...weights)
    return weights.map((weight) => weight / maximumWeight)
  }
  const toothHeightWeights = getToothHeightWeights(input.candidate)
  const minimumDepthLevel = Math.max(
    ...toothHeightWeights.map(
      (weight) => input.candidate.minimumHeight / weight,
    ),
  )
  // Four final bisection quanta keep a representable minimum-height tooth from
  // being rejected when the last midpoint lands microscopically below it.
  const depthSearchMargin =
    input.candidate.maximumDepth / 2 ** (DEPTH_SEARCH_ITERATIONS - 2)
  const minimumToothDepths = toothHeightWeights.map(
    (weight) => weight * (minimumDepthLevel + depthSearchMargin),
  )
  if (
    minimumToothDepths.some(
      (toothDepth) => toothDepth > input.candidate.maximumDepth,
    )
  )
    return null
  const minimumMeanderPoints = createMeanderReplacement({
    ...input.candidate,
    route: input.route,
    toothDepths: minimumToothDepths,
  })
  if (!input.isGeometryValid(minimumMeanderPoints)) return null
  const minimumRoute = replaceSegmentWithMeander({
    ...input.candidate,
    route: input.route,
    toothDepths: minimumToothDepths,
  })
  const targetAddedLength =
    getRouteLength({ ...input.route, route: minimumRoute }) -
    getRouteLength(input.route)
  const attempt = evaluateMeanderCandidate({
    ...input,
    targetAddedLength,
  })
  return attempt.valid ? attempt : null
}
