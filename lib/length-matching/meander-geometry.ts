import { getSegmentLength } from "../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../types"
import type { MeanderPlacement } from "./internal-types"

export type MeanderGeometryInput = {
  route: HighDensityRoute
  segmentIndex: number
  toothCount: number
  toothPitch: number
  toothDepths: number[]
  placement: MeanderPlacement
}

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
    replacement.push(
      entry,
      {
        ...entry,
        x: entry.x + normal.x * toothDepth,
        y: entry.y + normal.y * toothDepth,
      },
      {
        ...start,
        x: start.x + tangent.x * exitDistance + normal.x * toothDepth,
        y: start.y + tangent.y * exitDistance + normal.y * toothDepth,
      },
      {
        ...start,
        x: start.x + tangent.x * exitDistance,
        y: start.y + tangent.y * exitDistance,
      },
    )
  }
  replacement.push({ ...end })
  return roundMeanderCorners(replacement)
}

/** Construct a variable-height meander with tangentially rounded turns. */
export const replaceSegmentWithMeander = (
  input: MeanderGeometryInput,
): RoutePoint[] => [
  ...input.route.route.slice(0, input.segmentIndex),
  ...createMeanderReplacement(input),
  ...input.route.route.slice(input.segmentIndex + 2),
]
