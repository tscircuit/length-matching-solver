import type { Point } from "../model/internal-types"

/** Approach each terminal pair along its own perpendicular, facing the route. */
export function getTerminalPairRoutingDirection(
  {
    firstTerminal,
    secondTerminal,
  }: {
    firstTerminal: Point
    secondTerminal: Point
  },
  spineDirection: Point,
): Point {
  const deltaX = firstTerminal.x - secondTerminal.x
  const deltaY = firstTerminal.y - secondTerminal.y
  const separation = Math.hypot(deltaX, deltaY)
  if (separation < 1e-8)
    throw new Error("Differential pair terminals must be distinct")
  const direction = { x: deltaY / separation, y: -deltaX / separation }
  if (direction.x * spineDirection.x + direction.y * spineDirection.y < 0)
    return { x: -direction.x, y: -direction.y }
  return direction
}
