import { getTerminalPairRoutingDirection } from "../post-processing/routing/getTerminalPairRoutingDirection"
import { shouldReversePairTerminals } from "../post-processing/routing/shouldReversePairTerminals"
import type { TerminalFanoutGeometry } from "../post-processing/routing/DifferentialPairRoutingSession"
import type { SimpleRouteConnection } from "../types"

/** Prepare endpoint-only routing using each terminal pair’s perpendicular. */
export function getInitialTerminalFanoutGeometry(
  connections: SimpleRouteConnection[],
): TerminalFanoutGeometry {
  const [firstConnection, secondConnection] = connections
  const [firstStart, firstEnd] = firstConnection!.pointsToConnect
  const [secondStart, secondEnd] = secondConnection!.pointsToConnect
  const reverseSecond = shouldReversePairTerminals({
    firstStart: firstStart!,
    firstEnd: firstEnd!,
    secondStart: secondStart!,
    secondEnd: secondEnd!,
  })
  const alignedSecondStart = reverseSecond ? secondEnd! : secondStart!
  const alignedSecondEnd = reverseSecond ? secondStart! : secondEnd!
  const dx =
    firstEnd!.x + alignedSecondEnd.x - firstStart!.x - alignedSecondStart.x
  const dy =
    firstEnd!.y + alignedSecondEnd.y - firstStart!.y - alignedSecondStart.y
  const spineLength = Math.hypot(dx, dy) / 2
  const spineDirection = {
    x: dx / (2 * spineLength),
    y: dy / (2 * spineLength),
  }
  return {
    startDirection: getTerminalPairRoutingDirection(
      { firstTerminal: firstStart!, secondTerminal: alignedSecondStart },
      spineDirection,
    ),
    endDirection: getTerminalPairRoutingDirection(
      { firstTerminal: firstEnd!, secondTerminal: alignedSecondEnd },
      spineDirection,
    ),
    maximumStartTurnDegrees: 90,
    maximumEndTurnDegrees: 90,
    maximumTravelDistance: spineLength,
  }
}
