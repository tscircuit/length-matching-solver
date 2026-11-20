import type { Point } from "../model/internal-types"
import type { CoupledPathPoint } from "./types"

type TerminalFanoutLane = {
  point: Point
  polarity: 1 | -1
}

type ResolveTerminalFanoutStationInput = {
  anchor: CoupledPathPoint
  escapeDirection: Point
  pathDirection: Point
  centerlineSpacing: number
  side: 1 | -1
  lanes: [TerminalFanoutLane, TerminalFanoutLane]
  maxUncoupledLength?: number
  availableTravelDistance?: number
  maximumTurnDegrees: number
  innerGridStep: number
  isValid: (station: CoupledPathPoint) => boolean
}

/** Find the first clear station where terminal escape copper can become coupled. */
export const resolveTerminalFanoutStation = (
  input: ResolveTerminalFanoutStationInput,
): CoupledPathPoint | null => {
  const normal = {
    x: -input.pathDirection.y,
    y: input.pathDirection.x,
  }
  const tangentOfMaximumTurn = Math.tan(
    (input.maximumTurnDegrees * Math.PI) / 180,
  )
  const minimumTravelDistance = Math.max(
    0,
    ...input.lanes.map(({ point, polarity }) => {
      const terminalDelta = {
        x: point.x - input.anchor.x,
        y: point.y - input.anchor.y,
      }
      const longitudinal =
        terminalDelta.x * input.escapeDirection.x +
        terminalDelta.y * input.escapeDirection.y
      const transverse = terminalDelta.x * normal.x + terminalDelta.y * normal.y
      const laneOffset = (polarity * input.side * input.centerlineSpacing) / 2
      return (
        longitudinal + Math.abs(transverse - laneOffset) / tangentOfMaximumTurn
      )
    }),
  )
  const { maxUncoupledLength } = input
  const maximumTravelDistance =
    maxUncoupledLength ?? input.availableTravelDistance ?? minimumTravelDistance
  if (minimumTravelDistance > maximumTravelDistance + 1e-8) return null
  const stationStep = Math.max(0.05, Math.min(0.25, input.innerGridStep / 2))
  const searchDistance = maximumTravelDistance - minimumTravelDistance
  const stationCount = Math.max(1, Math.ceil(searchDistance / stationStep) + 1)
  for (let stationIndex = 0; stationIndex < stationCount; stationIndex++) {
    const travelDistance = Math.min(
      maximumTravelDistance,
      minimumTravelDistance + stationIndex * stationStep,
    )
    const station = {
      x: input.anchor.x + input.escapeDirection.x * travelDistance,
      y: input.anchor.y + input.escapeDirection.y * travelDistance,
      layer: input.anchor.layer,
    }
    const fanoutLengthsAreValid =
      maxUncoupledLength === undefined ||
      input.lanes.every(({ point, polarity }) => {
        const laneOffset = (polarity * input.side * input.centerlineSpacing) / 2
        const escapeLength = Math.hypot(
          station.x + normal.x * laneOffset - point.x,
          station.y + normal.y * laneOffset - point.y,
        )
        return escapeLength <= maxUncoupledLength + 1e-8
      })
    if (fanoutLengthsAreValid && input.isValid(station)) return station
  }
  return null
}
