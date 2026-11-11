import type { DifferentialPair } from "../../types"
import type { ParsedTrace, Point } from "../model/internal-types"

export type DifferentialPairPathJoin = {
  connectionNames: [string, string]
  point: Point
}

/** Align the routed lanes to the declared terminal pairs. */
export function getDifferentialPairTerminalAlignment(
  first: ParsedTrace,
  second: ParsedTrace,
  terminalPairs?: DifferentialPair["terminalPairs"],
): { reverseSecond: boolean; pathJoins: DifferentialPairPathJoin[] } {
  const distance = (a: Point, b: Point): number =>
    Math.hypot(a.x - b.x, a.y - b.y)
  const firstEnds = [first.points[0]!, first.points.at(-1)!] as const
  const secondEnds = [second.points[0]!, second.points.at(-1)!] as const
  if (!terminalPairs) {
    const forward =
      distance(firstEnds[0], secondEnds[0]) +
      distance(firstEnds[1], secondEnds[1])
    const reverse =
      distance(firstEnds[0], secondEnds[1]) +
      distance(firstEnds[1], secondEnds[0])
    return { reverseSecond: reverse + 1e-8 < forward, pathJoins: [] }
  }

  const isReversed = (
    trace: ParsedTrace,
    ends: readonly [Point, Point],
    start: Point,
    end: Point,
  ): boolean => {
    const forward =
      distance(ends[0], start) <= 1e-8 && distance(ends[1], end) <= 1e-8
    const reverse =
      distance(ends[0], end) <= 1e-8 && distance(ends[1], start) <= 1e-8
    if (forward === reverse)
      throw new Error(
        `PostProcessingSolver: route "${trace.source.connection_name}" must match its declared terminal pair endpoints`,
      )
    return reverse
  }

  const [start, end] = terminalPairs
  const firstReversed = isReversed(first, firstEnds, start[0], end[0])
  const secondReversed = isReversed(second, secondEnds, start[1], end[1])
  const laneNames = [
    first.source.connection_name,
    second.source.connection_name,
  ]
  const pathJoins = terminalPairs.flatMap((terminals) =>
    terminals.flatMap(({ x, y, connectedTo }, lane) =>
      connectedTo.map(
        (name): DifferentialPairPathJoin => ({
          connectionNames: [laneNames[lane]!, name],
          point: { x, y },
        }),
      ),
    ),
  )
  return { reverseSecond: firstReversed !== secondReversed, pathJoins }
}
