import { getRouteLength, getSegmentLength } from "../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../types"
import type {
  MeanderPlacement,
  RegressionAttempt,
  SegmentCandidate,
} from "./internal-types"

/** Construct the square-wave replacement for one same-layer route segment. */
export const replaceSegmentWithMeander = (input: {
  route: HighDensityRoute
  segmentIndex: number
  toothCount: number
  toothPitch: number
  depth: number
  placement: MeanderPlacement
}): RoutePoint[] => {
  const start = input.route.route[input.segmentIndex]!
  const end = input.route.route[input.segmentIndex + 1]!
  const segmentLength = getSegmentLength(start, end)
  const tangent = { x: (end.x - start.x) / segmentLength, y: (end.y - start.y) / segmentLength }
  const leadLength = (segmentLength - input.toothCount * input.toothPitch) / 2
  const replacement: RoutePoint[] = [{ ...start }]
  for (let toothIndex = 0; toothIndex < input.toothCount; toothIndex++) {
    const normalSign = input.placement === "balanced" ? toothIndex % 2 === 0 ? -1 : 1 : input.placement === "negative" ? -1 : 1
    const normal = { x: -tangent.y * normalSign, y: tangent.x * normalSign }
    const entryDistance = leadLength + toothIndex * input.toothPitch
    const exitDistance = entryDistance + input.toothPitch / 2
    const entry = { ...start, x: start.x + tangent.x * entryDistance, y: start.y + tangent.y * entryDistance }
    const upperEntry = { ...entry, x: entry.x + normal.x * input.depth, y: entry.y + normal.y * input.depth }
    const upperExit = { ...start, x: start.x + tangent.x * exitDistance + normal.x * input.depth, y: start.y + tangent.y * exitDistance + normal.y * input.depth }
    const exit = { ...start, x: start.x + tangent.x * exitDistance, y: start.y + tangent.y * exitDistance }
    replacement.push(entry, upperEntry, upperExit, exit)
  }
  replacement.push({ ...end })
  return [...input.route.route.slice(0, input.segmentIndex), ...replacement, ...input.route.route.slice(input.segmentIndex + 2)]
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
    const toothPitch = input.minimumToothPitch ?? Math.max(route.traceThickness * 4, 0.2)
    for (let segmentIndex = 0; segmentIndex < route.route.length - 1; segmentIndex++) {
      const start = route.route[segmentIndex]!
      const end = route.route[segmentIndex + 1]!
      const segmentLength = getSegmentLength(start, end)
      if (segmentLength <= 0 || start.z !== end.z) continue
      const toothCapacity = Math.min(Math.max(0, Math.floor(segmentLength / toothPitch) - 2), input.maxToothCount)
      for (let toothCount = 1; toothCount <= toothCapacity; toothCount++) {
        const placements: MeanderPlacement[] = toothCount % 2 === 0 ? ["balanced", "negative", "positive"] : ["negative", "positive"]
        for (const placement of placements) candidates.push({ routeIndex, segmentIndex, segmentLength, toothCount, maximumDepth: input.maximumDepth, toothPitch, placement })
      }
    }
  }
  const placementPriority: Record<MeanderPlacement, number> = { balanced: 0, negative: 1, positive: 2 }
  return candidates.sort((left, right) => left.toothCount - right.toothCount || placementPriority[left.placement] - placementPriority[right.placement] || right.segmentLength - left.segmentLength)
}

/** Measure two depths, fit a line, and predict the candidate depth in one step. */
export const evaluateMeanderCandidate = (input: {
  candidate: SegmentCandidate
  route: HighDensityRoute
  connectionName: string
  targetAddedLength: number
  lengthTolerance: number
  isGeometryValid: (meanderPoints: RoutePoint[]) => boolean
}): RegressionAttempt => {
  const originalLength = getRouteLength(input.route)
  const sampleDepths: [number, number] = [input.candidate.maximumDepth * 0.25, input.candidate.maximumDepth * 0.75]
  const firstSampleRoute = replaceSegmentWithMeander({
    ...input.candidate,
    route: input.route,
    depth: sampleDepths[0],
  })
  const secondSampleRoute = replaceSegmentWithMeander({
    ...input.candidate,
    route: input.route,
    depth: sampleDepths[1],
  })
  const sampleAddedLengths: [number, number] = [
    getRouteLength({ ...input.route, route: firstSampleRoute }) - originalLength,
    getRouteLength({ ...input.route, route: secondSampleRoute }) - originalLength,
  ]
  const slope = (sampleAddedLengths[1] - sampleAddedLengths[0]) / (sampleDepths[1] - sampleDepths[0])
  const intercept = sampleAddedLengths[0] - slope * sampleDepths[0]
  const predictedDepth = (input.targetAddedLength - intercept) / slope
  const predictedRoute = replaceSegmentWithMeander({
    ...input.candidate,
    route: input.route,
    depth: predictedDepth,
  })
  const resultingError = Math.abs(input.targetAddedLength - (getRouteLength({ ...input.route, route: predictedRoute }) - originalLength))
  const pointCount = input.candidate.toothCount * 4 + 2
  const meanderPoints = predictedRoute.slice(input.candidate.segmentIndex, input.candidate.segmentIndex + pointCount)
  const valid = Number.isFinite(predictedDepth) && predictedDepth > 0 && predictedDepth <= input.candidate.maximumDepth && resultingError <= input.lengthTolerance && input.isGeometryValid(meanderPoints)
  return { ...input.candidate, connectionName: input.connectionName, sampleDepths, sampleAddedLengths, slope, intercept, predictedDepth, predictedRoute, resultingError, testedSegment: [{ ...input.route.route[input.candidate.segmentIndex]! }, { ...input.route.route[input.candidate.segmentIndex + 1]! }], meanderPoints, valid }
}
