import type { Point } from "../model/internal-types"
import type { CoupledPathPoint } from "./types"

export const MAX_START_TERMINAL_TURN_DEGREES = 55

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

  const tangentOfMaximumTurn = Math.tan(
    (MAX_START_TERMINAL_TURN_DEGREES * Math.PI) / 180,
  )
  const forwardDistance = Math.max(
    ...projectedTerminals.map(({ parallel, perpendicular }, index) => {
      let offset = (side * centerlineSpacing) / 2
      if (index === 1) offset = -offset
      return parallel + Math.abs(perpendicular - offset) / tangentOfMaximumTurn
    }),
  )
  return {
    x: start.x + spineDirection.x * forwardDistance,
    y: start.y + spineDirection.y * forwardDistance,
    layer: start.layer,
  }
}
