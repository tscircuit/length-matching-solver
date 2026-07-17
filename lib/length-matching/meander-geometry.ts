import { getSegmentLength } from "../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../types"
import type { MeanderPlacement } from "./internal-types"
import type { StraightRouteSpan } from "./straight-route-spans"

export type MeanderGeometryInput = {
  route: HighDensityRoute
  span: StraightRouteSpan
  toothCount: number
  toothPitch: number
  toothDepths: number[]
  placement: MeanderPlacement
}

const CURVE_SEGMENT_COUNT = 6

const createGeneratedPoint = (
  source: RoutePoint,
  x: number,
  y: number,
): RoutePoint => ({
  x,
  y,
  z: source.z,
  ...(source.traceThickness === undefined
    ? {}
    : { traceThickness: source.traceThickness }),
})

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

export const createMeanderReplacement = (
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
  if (
    !Number.isInteger(input.span.startIndex) ||
    !Number.isInteger(input.span.endIndex) ||
    input.span.startIndex < 0 ||
    input.span.endIndex <= input.span.startIndex ||
    input.span.endIndex >= input.route.route.length
  )
    throw new Error(
      `LengthMatchingSolver: invalid straight route span ${input.span.startIndex}-${input.span.endIndex}`,
    )
  const start = input.route.route[input.span.startIndex]!
  const end = input.route.route[input.span.endIndex]!
  const segmentLength = getSegmentLength(start, end)
  if (
    segmentLength <= 0 ||
    start.z !== end.z ||
    Math.abs(segmentLength - input.span.length) > 1e-9
  )
    throw new Error(
      `LengthMatchingSolver: straight route span ${input.span.startIndex}-${input.span.endIndex} does not match its route geometry`,
    )
  const tangent = {
    x: (end.x - start.x) / segmentLength,
    y: (end.y - start.y) / segmentLength,
  }
  const occupiedLength = (input.toothCount - 0.5) * input.toothPitch
  const leadLength = (segmentLength - occupiedLength) / 2
  const replacement: RoutePoint[] = [
    createGeneratedPoint(start, start.x, start.y),
  ]
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
    const entry = createGeneratedPoint(
      start,
      start.x + tangent.x * entryDistance,
      start.y + tangent.y * entryDistance,
    )
    replacement.push(
      entry,
      createGeneratedPoint(
        start,
        entry.x + normal.x * toothDepth,
        entry.y + normal.y * toothDepth,
      ),
      createGeneratedPoint(
        start,
        start.x + tangent.x * exitDistance + normal.x * toothDepth,
        start.y + tangent.y * exitDistance + normal.y * toothDepth,
      ),
      createGeneratedPoint(
        start,
        start.x + tangent.x * exitDistance,
        start.y + tangent.y * exitDistance,
      ),
    )
  }
  replacement.push({ ...end })
  return roundMeanderCorners(replacement)
}

/** Construct a variable-height meander with tangentially rounded turns. */
export const replaceSegmentWithMeander = (
  input: MeanderGeometryInput,
): RoutePoint[] => [
  ...input.route.route.slice(0, input.span.startIndex),
  ...createMeanderReplacement(input),
  ...input.route.route.slice(input.span.endIndex + 1),
]
