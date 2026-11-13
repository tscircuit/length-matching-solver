import type { Point } from "../model/internal-types"

type TerminalRow = { first: Point; second: Point }
type ClassifyTerminalRowsInput = {
  start: TerminalRow
  end: TerminalRow
  normal: Point
}
type TerminalRowClassification = { inline: boolean; facing: boolean }
type ProjectedTerminalRow = {
  pitch: number
  stagger: number
  inline: boolean
}

/** Classify the terminal rows relative to the pair's routing spine. */
export function classifyTerminalRows(
  input: ClassifyTerminalRowsInput,
): TerminalRowClassification {
  const [startRow, endRow] = [input.start, input.end].map(
    ({ first, second }): ProjectedTerminalRow => {
      const dx = first.x - second.x
      const dy = first.y - second.y
      const pitch = dx * input.normal.x + dy * input.normal.y
      const stagger = Math.abs(dx * input.normal.y - dy * input.normal.x)
      const separation = Math.hypot(dx, dy)
      return {
        pitch,
        stagger,
        inline: separation > 1e-8 && Math.abs(pitch) / separation < 0.5,
      }
    },
  )
  const samePitch = Math.abs(startRow.pitch - endRow.pitch) < 1e-6
  // Equal-pitch facing rows can escape along the spine even when staggered
  // farther than a trace width. Oblique rows with different pitches keep the
  // general routing geometry rather than requiring this station layout.
  return {
    inline: startRow.inline && endRow.inline,
    facing:
      Math.max(startRow.stagger, endRow.stagger) < 1e-6 ||
      (!startRow.inline && !endRow.inline && samePitch),
  }
}
