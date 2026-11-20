import type { SearchGeometryValidator } from "../geometry/createSearchGeometryValidator"
import type { Point } from "../model/internal-types"
import { MAX_START_TERMINAL_TURN_DEGREES } from "./getForwardPairSearchStart"
import { resolveTerminalFanoutStation } from "./resolveTerminalFanoutStation"
import type { CoupledPathPoint } from "./types"

type FanoutEnd = {
  anchor: CoupledPathPoint
  direction: Point
  terminals: [Point, Point]
}

type ResolvePairFanoutStationsInput = {
  start: FanoutEnd
  end: FanoutEnd
  spineDirection: Point
  centerlineSpacing: number
  side: 1 | -1
  maxUncoupledLength?: number
  availableTravelDistance: number
  searchStep: number
  isTerminalFanoutValid: SearchGeometryValidator["isTerminalFanoutValid"]
}

export const resolvePairFanoutStations = (
  input: ResolvePairFanoutStationsInput,
): { start: CoupledPathPoint; end: CoupledPathPoint } | null => {
  const resolveStation = (
    terminal: "start" | "end",
  ): CoupledPathPoint | null => {
    const { anchor, direction, terminals } = input[terminal]
    const sign = terminal === "start" ? 1 : -1
    return resolveTerminalFanoutStation({
      anchor,
      escapeDirection: { x: direction.x * sign, y: direction.y * sign },
      pathDirection: direction,
      centerlineSpacing: input.centerlineSpacing,
      side: input.side,
      lanes: [
        { point: terminals[0], polarity: 1 },
        { point: terminals[1], polarity: -1 },
      ],
      maxUncoupledLength: input.maxUncoupledLength,
      availableTravelDistance: input.availableTravelDistance,
      searchStep: input.searchStep,
      maximumTurnDegrees:
        terminal === "start" ? MAX_START_TERMINAL_TURN_DEGREES : 45,
      isValid: (station) =>
        input.isTerminalFanoutValid(station, direction, terminal),
    })
  }

  const start = resolveStation("start")
  if (!start) return null
  const end = resolveStation("end")
  if (!end) return null
  const coupledTravel =
    (end.x - start.x) * input.spineDirection.x +
    (end.y - start.y) * input.spineDirection.y
  return coupledTravel > input.searchStep ? { start, end } : null
}
