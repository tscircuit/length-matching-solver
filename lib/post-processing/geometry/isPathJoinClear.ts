import { getMinimumSegmentDistance } from "../../route-geometry"
import type { CopperSegment, CopperVia } from "../model/internal-types"
import type { DifferentialPairPathJoin } from "../routing/getDifferentialPairTerminalAlignment"
import { clipCopperSegmentOutsideTerminal } from "./clipCopperSegmentOutsideTerminal"

/** Allow a declared same-lane join while checking all copper outside its terminal. */
export function isPathJoinClear(
  pathJoins: DifferentialPairPathJoin[],
  candidate: CopperSegment | CopperVia,
  other: CopperSegment | CopperVia,
  clearance: number,
): boolean {
  const join = pathJoins.find(
    ({ connectionName, connectedTo }) =>
      connectionName === candidate.connectionName &&
      ("connectionName" in connectedTo
        ? connectedTo.connectionName === other.connectionName
        : connectedTo.pcbTraceId === other.pcbTraceId),
  )
  if (!join) return false
  if ("layers" in candidate || "layers" in other) {
    return [candidate, other].every(
      (copper) =>
        !("layers" in copper) ||
        Math.hypot(copper.x - join.point.x, copper.y - join.point.y) <= 1e-8,
    )
  }
  return (
    [
      [candidate, other],
      [other, candidate],
    ] as const
  ).every(([segment, neighbor]) =>
    clipCopperSegmentOutsideTerminal(segment, join.point, clearance).every(
      (piece) =>
        getMinimumSegmentDistance(
          piece.start,
          piece.end,
          neighbor.start,
          neighbor.end,
        ) >=
        clearance - 1e-7,
    ),
  )
}
