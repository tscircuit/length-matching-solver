import { getRouteLength } from "../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../types"
import {
  createMeanderReplacement,
  replaceSegmentWithMeander,
} from "./meander-geometry"
import { getMeanderQualityScore } from "./meander-quality"
import type {
  MeanderHeightProfile,
  MeanderPlacement,
  RegressionAttempt,
  SegmentCandidate,
  ValidRegressionAttempt,
} from "./internal-types"
import { getTunableStraightRouteSpans } from "./straight-route-spans"

const DEPTH_SEARCH_ITERATIONS = 32
const DEFAULT_MIN_MEANDER_GAP = 0.3
export { replaceSegmentWithMeander } from "./meander-geometry"

type MeanderCandidateEvaluationInput = {
  candidate: SegmentCandidate
  route: HighDensityRoute
  connectionName: string
  lengthTolerance: number
  isGeometryValid: (meanderPoints: RoutePoint[]) => boolean
}

const getToothHeightWeights = (input: {
  toothCount: number
  heightProfile: MeanderHeightProfile
}): number[] => {
  if (input.heightProfile !== "tapered")
    return Array<number>(input.toothCount).fill(1)
  const weights = Array.from({ length: input.toothCount }, (_, toothIndex) =>
    Math.sin((Math.PI * (toothIndex + 1)) / (input.toothCount + 1)),
  )
  const maximumWeight = Math.max(...weights)
  return weights.map((weight) => weight / maximumWeight)
}

const getMaximumToothDepths = (input: {
  candidate: SegmentCandidate
  route: HighDensityRoute
  isGeometryValid: (meanderPoints: RoutePoint[]) => boolean
}): number[] => {
  const maximumToothDepths: number[] = []
  for (
    let toothIndex = 0;
    toothIndex < input.candidate.toothCount;
    toothIndex++
  ) {
    const maximumProfile = Array<number>(input.candidate.toothCount).fill(0)
    maximumProfile[toothIndex] = input.candidate.maximumDepth
    const maximumReplacement = createMeanderReplacement({
      ...input.candidate,
      route: input.route,
      toothDepths: maximumProfile,
    })
    if (input.isGeometryValid(maximumReplacement)) {
      maximumToothDepths.push(input.candidate.maximumDepth)
      continue
    }
    let validDepth = 0
    let invalidDepth = input.candidate.maximumDepth
    for (let iteration = 0; iteration < DEPTH_SEARCH_ITERATIONS; iteration++) {
      const testedDepth = (validDepth + invalidDepth) / 2
      const testedProfile = Array<number>(input.candidate.toothCount).fill(0)
      testedProfile[toothIndex] = testedDepth
      const testedReplacement = createMeanderReplacement({
        ...input.candidate,
        route: input.route,
        toothDepths: testedProfile,
      })
      if (input.isGeometryValid(testedReplacement)) validDepth = testedDepth
      else invalidDepth = testedDepth
    }
    maximumToothDepths.push(validDepth)
  }
  return maximumToothDepths
}

const findCappedDepthProfileForTargetLength = (input: {
  candidate: SegmentCandidate
  route: HighDensityRoute
  maximumToothDepths: number[]
  toothHeightWeights: number[]
  originalLength: number
  targetAddedLength: number
  isGeometryValid: (meanderPoints: RoutePoint[]) => boolean
}): { toothDepths: number[]; depthLevel: number } => {
  let lowerDepthLevel = 0
  let upperDepthLevel = input.candidate.maximumDepth
  for (let iteration = 0; iteration < DEPTH_SEARCH_ITERATIONS; iteration++) {
    const depthLevel = (lowerDepthLevel + upperDepthLevel) / 2
    const toothDepths = input.maximumToothDepths.map(
      (maximumDepth, toothIndex) =>
        Math.min(
          maximumDepth,
          depthLevel * input.toothHeightWeights[toothIndex]!,
        ),
    )
    const candidateRoute = replaceSegmentWithMeander({
      ...input.candidate,
      route: input.route,
      toothDepths,
    })
    const addedLength =
      getRouteLength({ ...input.route, route: candidateRoute }) -
      input.originalLength
    const meanderPoints = createMeanderReplacement({
      ...input.candidate,
      route: input.route,
      toothDepths,
    })
    if (!input.isGeometryValid(meanderPoints)) {
      upperDepthLevel = depthLevel
      continue
    }
    if (addedLength < input.targetAddedLength) lowerDepthLevel = depthLevel
    else upperDepthLevel = depthLevel
  }
  const depthLevel = (lowerDepthLevel + upperDepthLevel) / 2
  return {
    depthLevel,
    toothDepths: input.maximumToothDepths.map((maximumDepth, toothIndex) =>
      Math.min(
        maximumDepth,
        depthLevel * input.toothHeightWeights[toothIndex]!,
      ),
    ),
  }
}

/** Enumerate deterministic segment, tooth-count, and side choices for tuning. */
export const createMeanderCandidates = (input: {
  routes: HighDensityRoute[]
  routeIndexes: number[]
  maximumDepth: number
  minimumToothPitch?: number
  minMeanderGap?: number
  minMeanderHeight?: number
  maxToothCount: number
}): SegmentCandidate[] => {
  const candidates: SegmentCandidate[] = []
  for (const routeIndex of input.routeIndexes) {
    const route = input.routes[routeIndex]!
    const minMeanderGap =
      input.minMeanderGap ??
      Math.max(DEFAULT_MIN_MEANDER_GAP, route.traceThickness * 2)
    const minimumTraceCenterlineSpacing = route.traceThickness + minMeanderGap
    const toothPitch = Math.max(
      input.minimumToothPitch ?? 0,
      minimumTraceCenterlineSpacing * 2,
    )
    const minimumHeight =
      input.minMeanderHeight ?? minimumTraceCenterlineSpacing
    for (const span of getTunableStraightRouteSpans(route)) {
      const toothCapacity = Math.min(
        Math.max(0, Math.floor(span.length / toothPitch) - 1),
        input.maxToothCount,
      )
      for (let toothCount = 1; toothCount <= toothCapacity; toothCount++) {
        // Explore the open segment as well as the minimum-clearance footprint.
        // The geometric mean supplies one deterministic constrained compromise.
        const maximumRelaxedPitch = span.length / (toothCount + 1)
        const pitchOptions = [
          maximumRelaxedPitch,
          Math.sqrt(toothPitch * maximumRelaxedPitch),
          toothPitch,
        ].filter(
          (pitch, pitchIndex, pitches) =>
            pitches.findIndex(
              (otherPitch) => Math.abs(otherPitch - pitch) < 1e-9,
            ) === pitchIndex,
        )
        const placements: MeanderPlacement[] =
          toothCount % 2 === 0
            ? ["balanced", "negative", "positive"]
            : ["negative", "positive"]
        for (const candidatePitch of pitchOptions)
          for (const placement of placements)
            candidates.push({
              routeIndex,
              span,
              toothCount,
              maximumDepth: input.maximumDepth,
              minimumHeight,
              toothPitch: candidatePitch,
              placement,
              heightProfile: toothCount > 1 ? "tapered" : "uniform",
            })
      }
    }
  }
  const placementPriority: Record<MeanderPlacement, number> = {
    balanced: 0,
    negative: 1,
    positive: 2,
  }
  return candidates.sort(
    (left, right) =>
      left.toothCount - right.toothCount ||
      placementPriority[left.placement] - placementPriority[right.placement] ||
      right.toothPitch - left.toothPitch ||
      right.span.length - left.span.length,
  )
}

/** Fit a scale factor over clearance-limited tooth depths and predict a route. */
export const evaluateMeanderCandidate = (input: {
  candidate: SegmentCandidate
  route: HighDensityRoute
  connectionName: string
  targetAddedLength: number
  lengthTolerance: number
  isGeometryValid: (meanderPoints: RoutePoint[]) => boolean
}): RegressionAttempt => {
  const originalLength = getRouteLength(input.route)
  const maximumToothDepths = getMaximumToothDepths(input)
  const toothHeightWeights = getToothHeightWeights(input.candidate)
  const maximumDepthLevel = input.candidate.maximumDepth
  const maximumProfile = maximumToothDepths.map((maximumDepth, toothIndex) =>
    Math.min(maximumDepth, maximumDepthLevel * toothHeightWeights[toothIndex]!),
  )
  const sampleScaleFactors: [number, number] = [0.25, 0.75]
  const firstSampleDepths = maximumProfile.map(
    (maximumDepth) => maximumDepth * sampleScaleFactors[0],
  )
  const secondSampleDepths = maximumProfile.map(
    (maximumDepth) => maximumDepth * sampleScaleFactors[1],
  )
  const firstSampleRoute = replaceSegmentWithMeander({
    ...input.candidate,
    route: input.route,
    toothDepths: firstSampleDepths,
  })
  const secondSampleRoute = replaceSegmentWithMeander({
    ...input.candidate,
    route: input.route,
    toothDepths: secondSampleDepths,
  })
  const sampleAddedLengths: [number, number] = [
    getRouteLength({ ...input.route, route: firstSampleRoute }) -
      originalLength,
    getRouteLength({ ...input.route, route: secondSampleRoute }) -
      originalLength,
  ]
  const maximumScaleRoute = replaceSegmentWithMeander({
    ...input.candidate,
    route: input.route,
    toothDepths: maximumProfile,
  })
  const maximumAddedLength =
    getRouteLength({ ...input.route, route: maximumScaleRoute }) -
    originalLength
  const slope =
    (sampleAddedLengths[1] - sampleAddedLengths[0]) /
    (sampleScaleFactors[1] - sampleScaleFactors[0])
  const intercept = sampleAddedLengths[0] - slope * sampleScaleFactors[0]
  const regressionPredictedScaleFactor =
    slope > 0 && Number.isFinite(slope)
      ? (input.targetAddedLength - intercept) / slope
      : 0
  const matchedAddedLength = Math.min(
    input.targetAddedLength,
    maximumAddedLength,
  )
  const fittedProfile =
    input.targetAddedLength > 0 && matchedAddedLength > 0
      ? findCappedDepthProfileForTargetLength({
          candidate: input.candidate,
          route: input.route,
          maximumToothDepths,
          toothHeightWeights,
          originalLength,
          targetAddedLength: matchedAddedLength,
          isGeometryValid: input.isGeometryValid,
        })
      : {
          depthLevel: regressionPredictedScaleFactor * maximumDepthLevel,
          toothDepths: maximumProfile.map((maximumDepth) =>
            Math.max(0, maximumDepth * regressionPredictedScaleFactor),
          ),
        }
  const predictedScaleFactor = fittedProfile.depthLevel / maximumDepthLevel
  const predictedToothDepths = fittedProfile.toothDepths
  const predictedRoute = replaceSegmentWithMeander({
    ...input.candidate,
    route: input.route,
    toothDepths: predictedToothDepths,
  })
  const addedLength =
    getRouteLength({ ...input.route, route: predictedRoute }) - originalLength
  const resultingError = Math.abs(matchedAddedLength - addedLength)
  const meanderPoints = createMeanderReplacement({
    ...input.candidate,
    route: input.route,
    toothDepths: predictedToothDepths,
  })
  const scaleIsValid =
    Number.isFinite(predictedScaleFactor) &&
    predictedScaleFactor > 0 &&
    predictedScaleFactor <= 1
  const minimumHeightIsValid = predictedToothDepths.every(
    (toothDepth) =>
      toothDepth === 0 || toothDepth >= input.candidate.minimumHeight,
  )
  const geometryIsValid = input.isGeometryValid(meanderPoints)
  const invalidReason: RegressionAttempt["invalidReason"] = !scaleIsValid
    ? "invalid-scale"
    : resultingError > input.lengthTolerance
      ? "target-error"
      : !geometryIsValid
        ? "invalid-geometry"
        : !minimumHeightIsValid
          ? "below-minimum-height"
          : null
  const outcome = invalidReason
    ? { valid: false as const, invalidReason }
    : { valid: true as const, invalidReason: null }
  const attempt: RegressionAttempt = {
    ...input.candidate,
    connectionName: input.connectionName,
    maximumToothDepths,
    sampleScaleFactors,
    sampleAddedLengths,
    slope,
    intercept,
    predictedScaleFactor,
    predictedToothDepths,
    predictedRoute,
    addedLength,
    maximumAddedLength,
    resultingError,
    testedSegment: [
      { ...input.route.route[input.candidate.span.startIndex]! },
      { ...input.route.route[input.candidate.span.endIndex]! },
    ],
    meanderPoints,
    qualityScore: 0,
    ...outcome,
  }
  return { ...attempt, qualityScore: getMeanderQualityScore(attempt) }
}

/** Evaluate the shallowest minimum-height profile, or return null if rejected. */
export const evaluateMinimumMeanderCandidate = (
  input: MeanderCandidateEvaluationInput,
): ValidRegressionAttempt | null => {
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
