import type { Point } from "../model/internal-types"

export const getTerminalRowEscapeDirectionPairs = (
  startTerminals: [Point, Point],
  endTerminals: [Point, Point],
): Array<{ startDirection: Point; endDirection: Point }> => {
  const getDirections = ([first, second]: [Point, Point]): Point[] => {
    const rowX = first.x - second.x
    const rowY = first.y - second.y
    const rowLength = Math.hypot(rowX, rowY)
    if (rowLength <= 1e-8) return []
    // The coupled grid uses eight planar headings. Use the closest heading
    // to the row normal so the terminal lead and the first grid edge can align.
    const step = Math.PI / 4
    const angle = Math.round(Math.atan2(-rowX, rowY) / step) * step
    const direction = { x: Math.cos(angle), y: Math.sin(angle) }
    return [direction, { x: -direction.x, y: -direction.y }]
  }
  const endDirections = getDirections(endTerminals)
  return getDirections(startTerminals).flatMap((startDirection) =>
    endDirections.map((endDirection) => ({ startDirection, endDirection })),
  )
}
