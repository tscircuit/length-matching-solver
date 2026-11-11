import type { DifferentialPair, DifferentialPairPathSection } from "../../types"
import type { ParsedTrace, Point } from "../model/internal-types"

export type DifferentialPairPathJoin = {
  connectionName: string
  connectedTo: DifferentialPairPathSection
  point: Point
}

/** Align the routed lanes to the declared terminal pairs. */
export function getDifferentialPairTerminalAlignment(
  first: ParsedTrace,
  second: ParsedTrace,
  terminalPairs: NonNullable<DifferentialPair["terminalPairs"]>,
): { reverseSecond: boolean; pathJoins: DifferentialPairPathJoin[] } {
  const distance = (a: Point, b: Point): number =>
    Math.hypot(a.x - b.x, a.y - b.y)
  const isReversed = (
    trace: ParsedTrace,
    start: Point,
    end: Point,
  ): boolean => {
    const firstPoint = trace.points[0]!
    const lastPoint = trace.points.at(-1)!
    const forward =
      distance(firstPoint, start) <= 1e-8 && distance(lastPoint, end) <= 1e-8
    const reverse =
      distance(firstPoint, end) <= 1e-8 && distance(lastPoint, start) <= 1e-8
    if (forward === reverse)
      throw new Error(
        `PostProcessingSolver: route "${trace.source.connection_name}" must match its declared terminal pair endpoints`,
      )
    return reverse
  }

  const [start, end] = terminalPairs
  const firstReversed = isReversed(first, start[0], end[0])
  const secondReversed = isReversed(second, start[1], end[1])
  const laneNames = [
    first.source.connection_name,
    second.source.connection_name,
  ]
  const pathJoins = terminalPairs.flatMap((terminals) =>
    terminals.flatMap(({ x, y, connectedTo }, lane) =>
      connectedTo.map(
        (attachment): DifferentialPairPathJoin => ({
          connectionName: laneNames[lane]!,
          connectedTo: attachment,
          point: { x, y },
        }),
      ),
    ),
  )
  return { reverseSecond: firstReversed !== secondReversed, pathJoins }
}
