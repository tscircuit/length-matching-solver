import type { Point } from "../model/internal-types"

type TerminalRow = {
  first: Point
  second: Point
}

/** Determine how the terminal rows meet the pair spine at both ends. */
export function classifyTerminalRows(
  start: TerminalRow,
  end: TerminalRow,
  normal: Point,
  combinedRadii: number,
): { inline: boolean; facing: boolean } {
  const project = ({ first, second }: TerminalRow): {
    pitch: number
    stagger: number
    inline: boolean
  } => {
    const dx = first.x - second.x
    const dy = first.y - second.y
    const pitch = dx * normal.x + dy * normal.y
    const stagger = dx * normal.y - dy * normal.x
    const separation = Math.hypot(dx, dy)
    return {
      pitch,
      stagger: Math.abs(stagger),
      inline: separation > 1e-8 && Math.abs(pitch) / separation < 0.5,
    }
  }
  const startRow = project(start)
  const endRow = project(end)
  const largestStagger = Math.max(startRow.stagger, endRow.stagger)
  // Perpendicular rows may have different pitches. For staggered rows the
  // same-pitch escape applies when a transverse cut intersects both wire ends.
  // Different connector pitches on an oblique spine use the general search.
  const samePitch = Math.abs(startRow.pitch - endRow.pitch) < 1e-6
  return {
    inline: startRow.inline && endRow.inline,
    facing:
      largestStagger < 1e-6 ||
      (!startRow.inline && !endRow.inline && samePitch && largestStagger <= combinedRadii),
  }
}
