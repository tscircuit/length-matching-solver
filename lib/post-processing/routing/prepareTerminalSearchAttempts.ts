import { createSearchGeometryValidator } from "../geometry/createSearchGeometryValidator"
import { getCenterlineDistanceSamples } from "./getCenterlineDistanceSamples"
import {
  getForwardPairSearchStart,
  MAX_START_TERMINAL_TURN_DEGREES,
} from "./getForwardPairSearchStart"
import { resolvePostProcessingGridConfig } from "./resolvePostProcessingGridConfig"
import { resolveTerminalFanoutStation } from "./resolveTerminalFanoutStation"
import type { CoupledPathSearchInput } from "./types"
import type { PairRoutingGeometry } from "./getPairRoutingGeometry"

const MAX_END_TERMINAL_TURN_DEGREES = 45
const EDGE_GAP_SAMPLES = [0.75, 0.5, 1, 0.25, 1.25]

export type TerminalSearchMode = "forward" | "fanout"

export type TerminalSearchAttempt = {
  edgeGap: number
  side: 1 | -1
  input: CoupledPathSearchInput
}

export function prepareTerminalSearchAttempts(
  modes: TerminalSearchMode[],
  {
    pair,
    routingGrid,
    first,
    second,
    start,
    end,
    firstStart,
    firstEnd,
    secondStart,
    secondEnd,
    spineLength,
    spineDirection,
    normal,
    preferredSide,
    bothEndsAreInline,
    context,
  }: PairRoutingGeometry,
): TerminalSearchAttempt[] {
  const centerlineDistanceSamples = getCenterlineDistanceSamples({
    minimumCenterlineDistance: pair.minimumCenterlineDistance,
    maximumCenterlineDistance: pair.maximumCenterlineDistance,
    minimumPhysicalDistance: first.width / 2 + second.width / 2,
    legacyCenterlineDistances: EDGE_GAP_SAMPLES.map(
      (edgeGap) => edgeGap + first.width / 2 + second.width / 2,
    ),
  })
  const { maxUncoupledLength } = pair
  const sides: Array<1 | -1> = [preferredSide]
  if (preferredSide === 1) sides.push(-1)
  else sides.push(1)
  return centerlineDistanceSamples.flatMap((centerlineSpacing) => {
    const edgeGap = centerlineSpacing - first.width / 2 - second.width / 2
    const grid = resolvePostProcessingGridConfig({
      config: routingGrid,
      bounds: context.bounds,
      defaultInnerGridStep: Math.max(
        0.25,
        Math.min(0.5, centerlineSpacing / 2),
      ),
    })
    return sides.flatMap((side) =>
      modes.flatMap((terminalSearchMode) => {
        const useFanoutStations = terminalSearchMode === "fanout"
        let terminalMiterMargin: number | undefined
        if (useFanoutStations) terminalMiterMargin = centerlineSpacing / 2
        const validatorGeometry = {
          ...context,
          firstConnectionName: first.source.connection_name,
          secondConnectionName: second.source.connection_name,
          firstStartTerminal: firstStart,
          firstEndTerminal: firstEnd,
          secondStartTerminal: secondStart,
          secondEndTerminal: secondEnd,
          firstWidth: first.width,
          secondWidth: second.width,
          firstViaDiameter:
            first.transitions[0]?.via_diameter ?? first.viaDiameter,
          secondViaDiameter:
            second.transitions[0]?.via_diameter ?? second.viaDiameter,
          centerlineSpacing,
          side,
          terminalFanout: bothEndsAreInline,
          terminalMiterMargin,
        }
        let searchStart = start
        let searchEnd = end
        if (!bothEndsAreInline && !useFanoutStations) {
          searchStart = getForwardPairSearchStart({
            start,
            terminals: [firstStart, secondStart],
            spineDirection,
            spineNormal: normal,
            centerlineSpacing,
            side,
          })
        }
        if (!bothEndsAreInline && useFanoutStations) {
          const terminalValidator = createSearchGeometryValidator({
            ...validatorGeometry,
            start,
            end,
          })
          const startStation = resolveTerminalFanoutStation({
            anchor: start,
            escapeDirection: spineDirection,
            pathDirection: spineDirection,
            centerlineSpacing,
            side,
            lanes: [
              { point: firstStart, polarity: 1 },
              { point: secondStart, polarity: -1 },
            ],
            maxUncoupledLength,
            availableTravelDistance: spineLength,
            maximumTurnDegrees: MAX_START_TERMINAL_TURN_DEGREES,
            innerGridStep: grid.innerGridStep,
            isValid: (station) =>
              terminalValidator.isTerminalFanoutValid(
                station,
                spineDirection,
                "start",
              ),
          })
          if (!startStation) return []
          const endStation = resolveTerminalFanoutStation({
            anchor: end,
            escapeDirection: {
              x: -spineDirection.x,
              y: -spineDirection.y,
            },
            pathDirection: spineDirection,
            centerlineSpacing,
            side,
            lanes: [
              { point: firstEnd, polarity: 1 },
              { point: secondEnd, polarity: -1 },
            ],
            maxUncoupledLength,
            availableTravelDistance: spineLength,
            maximumTurnDegrees: MAX_END_TERMINAL_TURN_DEGREES,
            innerGridStep: grid.innerGridStep,
            isValid: (station) =>
              terminalValidator.isTerminalFanoutValid(
                station,
                spineDirection,
                "end",
              ),
          })
          if (!endStation) return []
          searchStart = startStation
          searchEnd = endStation
          const coupledTravel =
            (searchEnd.x - searchStart.x) * spineDirection.x +
            (searchEnd.y - searchStart.y) * spineDirection.y
          if (coupledTravel <= grid.innerGridStep) return []
        }
        const validator = createSearchGeometryValidator({
          ...validatorGeometry,
          start: searchStart,
          end: searchEnd,
        })
        return [
          {
            edgeGap,
            side,
            input: {
              start: searchStart,
              end: searchEnd,
              bounds: context.bounds,
              layerCount: context.layerCount,
              grid,
              ...validator,
            },
          },
        ]
      }),
    )
  })
}
