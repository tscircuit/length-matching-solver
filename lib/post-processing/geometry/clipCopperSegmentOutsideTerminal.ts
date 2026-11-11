import type { CopperSegment, Point } from "../model/internal-types"

/** Keep the pieces of a segment outside the clearance area of a shared terminal. */
export function clipCopperSegmentOutsideTerminal(
  segment: CopperSegment,
  terminal: Point,
  radius: number,
): CopperSegment[] {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) {
    return Math.hypot(
      segment.start.x - terminal.x,
      segment.start.y - terminal.y,
    ) < radius
      ? []
      : [segment]
  }
  const closest =
    ((terminal.x - segment.start.x) * dx +
      (terminal.y - segment.start.y) * dy) /
    lengthSquared
  const closestX = segment.start.x + dx * closest
  const closestY = segment.start.y + dy * closest
  const offsetSquared =
    radius * radius -
    ((closestX - terminal.x) ** 2 + (closestY - terminal.y) ** 2)
  if (offsetSquared <= 0) return [segment]
  const half = Math.sqrt(offsetSquared / lengthSquared)
  const enter = Math.max(0, closest - half)
  const exit = Math.min(1, closest + half)
  if (enter >= exit) return [segment]
  const pieces: CopperSegment[] = []
  if (enter > 0) {
    pieces.push({
      ...segment,
      end: { x: segment.start.x + dx * enter, y: segment.start.y + dy * enter },
    })
  }
  if (exit < 1) {
    pieces.push({
      ...segment,
      start: { x: segment.start.x + dx * exit, y: segment.start.y + dy * exit },
    })
  }
  return pieces
}
