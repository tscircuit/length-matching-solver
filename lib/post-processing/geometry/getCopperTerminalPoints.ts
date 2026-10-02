import type { CopperSegment, CopperVia, Point } from "../model/internal-types"

export function getCopperTerminalPoints(
  copper: CopperSegment | CopperVia,
): Point[] {
  if (!copper.terminal) return []
  if (!("start" in copper)) return [copper]
  const points: Point[] = []
  if (copper.terminal === "start" || copper.terminal === "both")
    points.push(copper.start)
  if (copper.terminal === "end" || copper.terminal === "both")
    points.push(copper.end)
  return points
}
