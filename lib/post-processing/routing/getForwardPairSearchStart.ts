import type { Point } from "../model/internal-types"
import type { CoupledPathPoint } from "./types"

type ForwardPairSearchStartInput = {
  start: CoupledPathPoint
  terminals: [Point, Point]
  spineDirection: Point
  spineNormal: Point
  centerlineSpacing: number
  side: 1 | -1
}

/** Moves a spine start past the forward pad of a staggered terminal row. */
export function getForwardPairSearchStart({
  start,
  terminals,
  spineDirection,
  spineNormal,
  centerlineSpacing,
  side,
}: ForwardPairSearchStartInput): CoupledPathPoint {
  const projectedTerminals = terminals.map((terminal) => {
    const dx = terminal.x - start.x
    const dy = terminal.y - start.y
    return {
      parallel: dx * spineDirection.x + dy * spineDirection.y,
      perpendicular: dx * spineNormal.x + dy * spineNormal.y,
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
    x: start.x + spineDirection.x * forwardDistance,
    y: start.y + spineDirection.y * forwardDistance,
    layer: start.layer,
  }
}
