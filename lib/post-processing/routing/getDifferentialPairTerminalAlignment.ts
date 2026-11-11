import type { DifferentialPair, SimplifiedPcbTrace } from "../../types"
import type { ParsedTrace, Point } from "../model/internal-types"

export type DifferentialPairPathJoin = {
  connectionNames: [string, string]
  point: Point
}

/** Match the declared neighboring sections at the terminals they share. */
export function getDifferentialPairTerminalAlignment(
  first: ParsedTrace,
  second: ParsedTrace,
  traces: SimplifiedPcbTrace[],
  adjacentConnectionNames?: DifferentialPair["adjacentConnectionNames"],
): { reverseSecond: boolean; pathJoins: DifferentialPairPathJoin[] } {
  const distance = (a: Point, b: Point): number =>
    Math.hypot(a.x - b.x, a.y - b.y)
  const firstEnds = [first.points[0]!, first.points.at(-1)!] as const
  const secondEnds = [second.points[0]!, second.points.at(-1)!] as const
  if (!adjacentConnectionNames?.length) {
    const forward =
      distance(firstEnds[0], secondEnds[0]) +
      distance(firstEnds[1], secondEnds[1])
    const reverse =
      distance(firstEnds[0], secondEnds[1]) +
      distance(firstEnds[1], secondEnds[0])
    return { reverseSecond: reverse + 1e-8 < forward, pathJoins: [] }
  }

  const findSharedTerminal = (
    trace: ParsedTrace,
    ends: readonly [Point, Point],
    adjacentName: string,
  ): 0 | 1 => {
    const adjacent = traces.filter(
      (entry) => entry.connection_name === adjacentName,
    )
    if (adjacent.length !== 1)
      throw new Error(
        `PostProcessingSolver: declared path neighbor "${adjacentName}" must resolve to exactly one trace`,
      )
    const adjacentRoute = adjacent[0]!.route
    const adjacentStart = adjacentRoute.find(
      (entry) => entry.route_type === "wire",
    )
    const adjacentEnd = adjacentRoute.findLast(
      (entry) => entry.route_type === "wire",
    )
    const neighboringTerminals = [
      [adjacentStart, adjacentStart?.start_pcb_port_id],
      [adjacentEnd, adjacentEnd?.end_pcb_port_id],
    ] as const
    const terminalMatches = ends.map((point, index) => {
      const portId = index === 0 ? trace.startPortId : trace.endPortId
      return neighboringTerminals.some(
        ([end, adjacentPortId]) =>
          end !== undefined &&
          (!portId || !adjacentPortId || portId === adjacentPortId) &&
          distance(point, end) <= 1e-8,
      )
    })
    if (terminalMatches[0] === terminalMatches[1])
      throw new Error(
        `PostProcessingSolver: path neighbors "${trace.source.connection_name}" and "${adjacentName}" must share exactly one terminal`,
      )
    return terminalMatches[0] ? 0 : 1
  }

  const pathJoins: DifferentialPairPathJoin[] = []
  const seenTerminals = new Set<number>()
  let reverseSecond = false
  for (const [firstNeighbor, secondNeighbor] of adjacentConnectionNames) {
    const firstTerminal = findSharedTerminal(first, firstEnds, firstNeighbor)
    const secondTerminal = findSharedTerminal(
      second,
      secondEnds,
      secondNeighbor,
    )
    const reverse = firstTerminal !== secondTerminal
    if (
      seenTerminals.has(firstTerminal) ||
      (seenTerminals.size > 0 && reverseSecond !== reverse)
    )
      throw new Error(
        `PostProcessingSolver: path neighbors for "${first.source.connection_name}/${second.source.connection_name}" disagree on terminal order`,
      )
    seenTerminals.add(firstTerminal)
    reverseSecond = reverse
    pathJoins.push(
      {
        connectionNames: [first.source.connection_name, firstNeighbor],
        point: firstEnds[firstTerminal],
      },
      {
        connectionNames: [second.source.connection_name, secondNeighbor],
        point: secondEnds[secondTerminal],
      },
    )
  }
  return { reverseSecond, pathJoins }
}
