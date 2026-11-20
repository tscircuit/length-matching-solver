import type { Point } from "../model/internal-types"
import type { CoupledPathPoint } from "./types"

type ForwardEgressInput = {
  start: CoupledPathPoint
  terminals: [Point, Point]
  direction: Point
  normal: Point
  centerlineSpacing: number
  side: 1 | -1
}

/** Moves a spine start past the forward pad of a staggered terminal row. */
export function getForwardEgressSearchStart({
  start,
  terminals,
  direction,
  normal,
  centerlineSpacing,
  side,
}: ForwardEgressInput): CoupledPathPoint {
  const projectedTerminals = terminals.map((terminal) => {
    const dx = terminal.x - start.x
    const dy = terminal.y - start.y
    return {
      parallel: dx * direction.x + dy * direction.y,
      perpendicular: dx * normal.x + dy * normal.y,
    }
  })
  if (!projectedTerminals.some(({ parallel }) => parallel > 1e-8)) return start

  const tangentOfMaximumTurn = Math.tan((55 * Math.PI) / 180)
  const forwardDistance = Math.max(
    ...projectedTerminals.map(({ parallel, perpendicular }, index) => {
      const polarity = index === 0 ? 1 : -1
      const offset = (polarity * side * centerlineSpacing) / 2
      return parallel + Math.abs(perpendicular - offset) / tangentOfMaximumTurn
    }),
  )
  return {
    x: start.x + direction.x * forwardDistance,
    y: start.y + direction.y * forwardDistance,
    layer: start.layer,
  }
}
