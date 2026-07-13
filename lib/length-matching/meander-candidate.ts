import { getRouteLength, getSegmentLength } from "../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../types"
import {
  createMeanderReplacement,
  replaceSegmentWithMeander,
} from "./meander-geometry"
import type {
  MeanderPlacement,
  RegressionAttempt,
  SegmentCandidate,
} from "./internal-types"

const DEPTH_SEARCH_ITERATIONS = 32
export { replaceSegmentWithMeander } from "./meander-geometry"

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

const findScaleFactorForTargetLength = (input: {
  candidate: SegmentCandidate
  route: HighDensityRoute
  maximumToothDepths: number[]
  originalLength: number
  targetAddedLength: number
}): number => {
  let lowerScaleFactor = 0
  let upperScaleFactor = 1
  for (let iteration = 0; iteration < DEPTH_SEARCH_ITERATIONS; iteration++) {
    const scaleFactor = (lowerScaleFactor + upperScaleFactor) / 2
    const toothDepths = input.maximumToothDepths.map(
      (maximumDepth) => maximumDepth * scaleFactor,
    )
    const candidateRoute = replaceSegmentWithMeander({
      ...input.candidate,
      route: input.route,
      toothDepths,
    })
    const addedLength =
      getRouteLength({ ...input.route, route: candidateRoute }) -
      input.originalLength
    if (addedLength < input.targetAddedLength) lowerScaleFactor = scaleFactor
    else upperScaleFactor = scaleFactor
  }
  return (lowerScaleFactor + upperScaleFactor) / 2
}

/** Enumerate deterministic segment, tooth-count, and side choices for tuning. */
export const createMeanderCandidates = (input: {
  routes: HighDensityRoute[]
  routeIndexes: number[]
  maximumDepth: number
  minimumToothPitch?: number
  minMeanderGap: number
  minMeanderHeight?: number
  maxToothCount: number
}): SegmentCandidate[] => {
  const candidates: SegmentCandidate[] = []
  for (const routeIndex of input.routeIndexes) {
    const route = input.routes[routeIndex]!
    const minimumTraceCenterlineSpacing =
      route.traceThickness + input.minMeanderGap
    const toothPitch = Math.max(
      input.minimumToothPitch ?? 0,
      minimumTraceCenterlineSpacing * 2,
    )
    const minimumHeight =
      input.minMeanderHeight ?? minimumTraceCenterlineSpacing
    for (
      let segmentIndex = 0;
      segmentIndex < route.route.length - 1;
      segmentIndex++
    ) {
      const start = route.route[segmentIndex]!
      const end = route.route[segmentIndex + 1]!
      const segmentLength = getSegmentLength(start, end)
      if (segmentLength <= 0 || start.z !== end.z) continue
      const toothCapacity = Math.min(
        Math.max(0, Math.floor(segmentLength / toothPitch) - 2),
        input.maxToothCount,
      )
      for (let toothCount = 1; toothCount <= toothCapacity; toothCount++) {
        const placements: MeanderPlacement[] =
          toothCount % 2 === 0
            ? ["balanced", "negative", "positive"]
            : ["negative", "positive"]
        for (const placement of placements)
          candidates.push({
            routeIndex,
            segmentIndex,
            segmentLength,
            toothCount,
            maximumDepth: input.maximumDepth,
            minimumHeight,
            toothPitch,
            placement,
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
      right.segmentLength - left.segmentLength,
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
  const sampleScaleFactors: [number, number] = [0.25, 0.75]
  const firstSampleDepths = maximumToothDepths.map(
    (maximumDepth) => maximumDepth * sampleScaleFactors[0],
  )
  const secondSampleDepths = maximumToothDepths.map(
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
    toothDepths: maximumToothDepths,
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
  const predictedScaleFactor =
    input.targetAddedLength > 0 && matchedAddedLength > 0
      ? findScaleFactorForTargetLength({
          candidate: input.candidate,
          route: input.route,
          maximumToothDepths,
          originalLength,
          targetAddedLength: matchedAddedLength,
        })
      : regressionPredictedScaleFactor
  const geometryScaleFactor =
    Number.isFinite(predictedScaleFactor) && predictedScaleFactor > 0
      ? predictedScaleFactor
      : 0
  const predictedToothDepths = maximumToothDepths.map(
    (maximumDepth) => maximumDepth * geometryScaleFactor,
  )
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
  const valid =
    Number.isFinite(predictedScaleFactor) &&
    predictedScaleFactor > 0 &&
    predictedScaleFactor <= 1 &&
    predictedToothDepths.every(
      (toothDepth) =>
        toothDepth === 0 || toothDepth >= input.candidate.minimumHeight,
    ) &&
    resultingError <= input.lengthTolerance &&
    input.isGeometryValid(meanderPoints)
  return {
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
    resultingError,
    testedSegment: [
      { ...input.route.route[input.candidate.segmentIndex]! },
      { ...input.route.route[input.candidate.segmentIndex + 1]! },
    ],
    meanderPoints,
    valid,
  }
}
