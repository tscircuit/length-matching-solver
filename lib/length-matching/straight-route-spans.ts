import { getSegmentLength } from "../route-geometry"
import type { HighDensityRoute, RoutePoint } from "../types"

/** A maximal same-layer, forward-collinear route span that can be meandered. */
export type StraightRouteSpan = {
  readonly startIndex: number
  readonly endIndex: number
  readonly length: number
  readonly traceThickness: number
}

const hasProtectedEdgeMetadata = (
  route: HighDensityRoute,
  start: RoutePoint,
  end: RoutePoint,
): boolean => {
  const effectiveTraceThickness =
    start.traceThickness ?? route.traceThickness
  return (
    start.toNextSegmentType !== undefined ||
    start.insideJumperPad === true ||
    end.insideJumperPad === true ||
    effectiveTraceThickness !== route.traceThickness ||
    !Number.isFinite(effectiveTraceThickness) ||
    effectiveTraceThickness <= 0
  )
}

const getDirection = (
  start: RoutePoint,
  end: RoutePoint,
): { x: number; y: number; length: number } => {
  const x = end.x - start.x
  const y = end.y - start.y
  return { x, y, length: Math.hypot(x, y) }
}

/** Partition a route into tunable spans without crossing semantic breakpoints. */
export const getTunableStraightRouteSpans = (
  route: HighDensityRoute,
): StraightRouteSpan[] => {
  const spans: StraightRouteSpan[] = []
  let startIndex = 0
  while (startIndex < route.route.length - 1) {
    const start = route.route[startIndex]!
    const firstEnd = route.route[startIndex + 1]!
    if (
      start.z !== firstEnd.z ||
      hasProtectedEdgeMetadata(route, start, firstEnd)
    ) {
      startIndex++
      continue
    }
    const traceThickness = start.traceThickness ?? route.traceThickness
    let endIndex = startIndex + 1
    let direction = getDirection(start, firstEnd)
    while (direction.length === 0 && endIndex < route.route.length - 1) {
      const current = route.route[endIndex]!
      const next = route.route[endIndex + 1]!
      const nextTraceThickness =
        current.traceThickness ?? route.traceThickness
      if (
        current.z !== start.z ||
        next.z !== start.z ||
        nextTraceThickness !== traceThickness ||
        hasProtectedEdgeMetadata(route, current, next)
      )
        break
      endIndex++
      direction = getDirection(start, next)
    }
    if (direction.length === 0) {
      startIndex = endIndex
      continue
    }
    while (endIndex < route.route.length - 1) {
      const current = route.route[endIndex]!
      const next = route.route[endIndex + 1]!
      const nextTraceThickness =
        current.traceThickness ?? route.traceThickness
      if (
        current.z !== start.z ||
        next.z !== start.z ||
        nextTraceThickness !== traceThickness ||
        hasProtectedEdgeMetadata(route, current, next)
      )
        break
      const nextDirection = getDirection(current, next)
      if (nextDirection.length === 0) {
        endIndex++
        continue
      }
      const cross =
        direction.x * nextDirection.y - direction.y * nextDirection.x
      const dot =
        direction.x * nextDirection.x + direction.y * nextDirection.y
      if (
        Math.abs(cross) > direction.length * nextDirection.length * 1e-9 ||
        dot <= 0
      )
        break
      endIndex++
    }
    spans.push({
      startIndex,
      endIndex,
      length: getSegmentLength(start, route.route[endIndex]!),
      traceThickness,
    })
    startIndex = endIndex
  }
  return spans
}
