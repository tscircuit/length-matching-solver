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
const CURVE_SEGMENT_COUNT = 6

const roundMeanderCorners = (points: RoutePoint[]): RoutePoint[] => {
  if (points.length < 3) return points
  const roundedPoints: RoutePoint[] = [{ ...points[0]! }]
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1]!
    const corner = points[index]!
    const next = points[index + 1]!
    const incomingLength = Math.hypot(
      corner.x - previous.x,
      corner.y - previous.y,
    )
    const outgoingLength = Math.hypot(next.x - corner.x, next.y - corner.y)
    if (incomingLength === 0 || outgoingLength === 0)
      throw new Error(
        "LengthMatchingSolver: meander contains a zero-length segment",
      )
    const incoming = {
      x: (corner.x - previous.x) / incomingLength,
      y: (corner.y - previous.y) / incomingLength,
    }
    const outgoing = {
      x: (next.x - corner.x) / outgoingLength,
      y: (next.y - corner.y) / outgoingLength,
    }
    if (Math.abs(incoming.x * outgoing.y - incoming.y * outgoing.x) < 1e-9) {
      roundedPoints.push({ ...corner })
      continue
    }
    const radius = Math.min(incomingLength, outgoingLength) / 2
    const curveStart = {
      ...corner,
      x: corner.x - incoming.x * radius,
      y: corner.y - incoming.y * radius,
    }
    const curveEnd = {
      ...corner,
      x: corner.x + outgoing.x * radius,
      y: corner.y + outgoing.y * radius,
    }
    const lastRoundedPoint = roundedPoints.at(-1)!
    if (
      curveStart.x !== lastRoundedPoint.x ||
      curveStart.y !== lastRoundedPoint.y
    )
      roundedPoints.push(curveStart)
    for (let segment = 1; segment < CURVE_SEGMENT_COUNT; segment++) {
      const progress = segment / CURVE_SEGMENT_COUNT
      const remaining = 1 - progress
      roundedPoints.push({
        ...corner,
        x:
          remaining ** 2 * curveStart.x +
          2 * remaining * progress * corner.x +
          progress ** 2 * curveEnd.x,
        y:
          remaining ** 2 * curveStart.y +
          2 * remaining * progress * corner.y +
          progress ** 2 * curveEnd.y,
      })
    }
    roundedPoints.push(curveEnd)
  }
  roundedPoints.push({ ...points[points.length - 1]! })
  return roundedPoints
}

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
  return roundMeanderCorners(replacement)
}

/** Construct a variable-height meander with tangentially rounded turns. */
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
  const predictedScaleFactor =
    input.targetAddedLength > 0 &&
    input.targetAddedLength <= maximumAddedLength + input.lengthTolerance
      ? findScaleFactorForTargetLength({
          candidate: input.candidate,
          route: input.route,
          maximumToothDepths,
          originalLength,
          targetAddedLength: input.targetAddedLength,
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
    resultingError,
    testedSegment: [
      { ...input.route.route[input.candidate.segmentIndex]! },
      { ...input.route.route[input.candidate.segmentIndex + 1]! },
    ],
    meanderPoints,
    valid,
  }
}
