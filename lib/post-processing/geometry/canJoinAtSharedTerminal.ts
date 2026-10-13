import { distance } from "@tscircuit/math-utils"
import type { CopperSegment, CopperVia } from "../model/internal-types"
import { getCopperTerminalPoints } from "./getCopperTerminalPoints"
import type { HighDensityRoute } from "../../types"

type ConnectionName = HighDensityRoute["connectionName"]
export type ConnectionRoots = ReadonlyMap<ConnectionName, ConnectionName>

export function canJoinAtSharedTerminal(
  copper: [CopperSegment | CopperVia, CopperSegment | CopperVia],
  roots: ConnectionRoots | undefined,
): boolean {
  const [first, second] = copper
  const root = roots?.get(first.connectionName)
  if (root === undefined || root !== roots?.get(second.connectionName))
    return false
  const TERMINAL_POSITION_EPSILON_MM = 1e-7
  const shared = getCopperTerminalPoints(first).find((point) =>
    getCopperTerminalPoints(second).some(
      (other) => distance(point, other) < TERMINAL_POSITION_EPSILON_MM,
    ),
  )
  if (!shared) return false
  if (!("start" in first) || !("start" in second)) return true
  let firstOther = first.start
  if (distance(shared, first.start) < TERMINAL_POSITION_EPSILON_MM)
    firstOther = first.end
  let secondOther = second.start
  if (distance(shared, second.start) < TERMINAL_POSITION_EPSILON_MM)
    secondOther = second.end
  // Opposing terminal exits meet without doubling back over the same copper.
  return (
    (firstOther.x - shared.x) * (secondOther.x - shared.x) +
      (firstOther.y - shared.y) * (secondOther.y - shared.y) <=
    0
  )
}
