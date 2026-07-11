import { getRouteLength, getSegmentLength } from "../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../types"
import type {
  MeanderPlacement,
  RegressionAttempt,
  SegmentCandidate,
} from "./internal-types"

type MeanderGeometryInput = {
  route: HighDensityRoute
  segmentIndex: number
  toothCount: number
  toothPitch: number
  toothDepths: number[]
  placement: MeanderPlacement
}

const DEPTH_SEARCH_ITERATIONS = 32

const createMeanderReplacement = (
  input: MeanderGeometryInput,
): RoutePoint[] => {
  if (input.toothDepths.length !== input.toothCount)
    throw new Error(
      `LengthMatchingSolver: expected ${input.toothCount} tooth depths, received ${input.toothDepths.length}`,
    )
  if (
    input.toothDepths.some(
      (toothDepth) => !Number.isFinite(toothDepth) || toothDepth < 0,
    )
  )
    throw new Error(
      "LengthMatchingSolver: every meander tooth depth must be a non-negative finite number",
    )
  const start = input.route.route[input.segmentIndex]!
  const end = input.route.route[input.segmentIndex + 1]!
  const segmentLength = getSegmentLength(start, end)
  const tangent = {
    x: (end.x - start.x) / segmentLength,
    y: (end.y - start.y) / segmentLength,
  }
  const leadLength = (segmentLength - input.toothCount * input.toothPitch) / 2
  const replacement: RoutePoint[] = [{ ...start }]
  for (let toothIndex = 0; toothIndex < input.toothCount; toothIndex++) {
    const toothDepth = input.toothDepths[toothIndex]!
    if (toothDepth === 0) continue
    const normalSign =
      input.placement === "balanced"
        ? toothIndex % 2 === 0
          ? -1
          : 1
        : input.placement === "negative"
          ? -1
          : 1
    const normal = { x: -tangent.y * normalSign, y: tangent.x * normalSign }
    const entryDistance = leadLength + toothIndex * input.toothPitch
    const exitDistance = entryDistance + input.toothPitch / 2
    const entry = {
      ...start,
      x: start.x + tangent.x * entryDistance,
      y: start.y + tangent.y * entryDistance,
    }
    const upperEntry = {
      ...entry,
      x: entry.x + normal.x * toothDepth,
      y: entry.y + normal.y * toothDepth,
    }
    const upperExit = {
      ...start,
      x: start.x + tangent.x * exitDistance + normal.x * toothDepth,
      y: start.y + tangent.y * exitDistance + normal.y * toothDepth,
    }
    const exit = {
      ...start,
      x: start.x + tangent.x * exitDistance,
      y: start.y + tangent.y * exitDistance,
    }
    replacement.push(entry, upperEntry, upperExit, exit)
  }
  replacement.push({ ...end })
  return replacement
}

/** Construct a variable-height square-wave replacement for one route segment. */
export const replaceSegmentWithMeander = (
  input: MeanderGeometryInput,
): RoutePoint[] => {
  const replacement = createMeanderReplacement(input)
  return [
    ...input.route.route.slice(0, input.segmentIndex),
    ...replacement,
    ...input.route.route.slice(input.segmentIndex + 2),
  ]
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

/** Enumerate deterministic segment, tooth-count, and side choices for tuning. */
export const createMeanderCandidates = (input: {
  routes: HighDensityRoute[]
  routeIndexes: number[]
  maximumDepth: number
  minimumToothPitch?: number
  maxToothCount: number
}): SegmentCandidate[] => {
  const candidates: SegmentCandidate[] = []
  for (const routeIndex of input.routeIndexes) {
    const route = input.routes[routeIndex]!
    const toothPitch =
      input.minimumToothPitch ?? Math.max(route.traceThickness * 4, 0.2)
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
  const slope =
    (sampleAddedLengths[1] - sampleAddedLengths[0]) /
    (sampleScaleFactors[1] - sampleScaleFactors[0])
  const intercept = sampleAddedLengths[0] - slope * sampleScaleFactors[0]
  const predictedScaleFactor =
    slope > 0 && Number.isFinite(slope)
      ? (input.targetAddedLength - intercept) / slope
      : 0
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
  const resultingError = Math.abs(
    input.targetAddedLength -
      (getRouteLength({ ...input.route, route: predictedRoute }) -
        originalLength),
  )
  const meanderPoints = createMeanderReplacement({
    ...input.candidate,
    route: input.route,
    toothDepths: predictedToothDepths,
  })
  const valid =
    Number.isFinite(predictedScaleFactor) &&
    predictedScaleFactor > 0 &&
    predictedScaleFactor <= 1 &&
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
    resultingError,
    testedSegment: [
      { ...input.route.route[input.candidate.segmentIndex]! },
      { ...input.route.route[input.candidate.segmentIndex + 1]! },
    ],
    meanderPoints,
    valid,
  }
}
