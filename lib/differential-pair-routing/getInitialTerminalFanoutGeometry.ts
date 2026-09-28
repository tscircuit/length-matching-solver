import { getTerminalPairRoutingDirection } from "../post-processing/routing/getTerminalPairRoutingDirection"
import { shouldReversePairTerminals } from "../post-processing/routing/shouldReversePairTerminals"
import type { TerminalFanoutGeometry } from "../post-processing/routing/DifferentialPairRoutingSession"
import type { SimpleRouteConnection } from "../types"

/** Prepare endpoint-only routing without imposing turn limits on constrained fanout. */
export function getInitialTerminalFanoutGeometry(
  connections: SimpleRouteConnection[],
  maxUncoupledLength: number | undefined,
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
  if (maxUncoupledLength === undefined)
    return {
      startDirection: spineDirection,
      endDirection: spineDirection,
      maximumStartTurnDegrees: 55,
      maximumEndTurnDegrees: 45,
      maximumTravelDistance: spineLength,
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
