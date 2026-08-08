import type {
  PcbLayer,
  PcbTraceForPostProcessing,
  PcbTraceWireRoutePoint,
  PcbViaForPostProcessing,
  ResolvedDifferentialPair,
  ResolvedDifferentialPairPostProcessingParams,
} from "../types"
import type { DifferentialPairDrcChecker } from "../validation/DifferentialPairDrcChecker"
import { CoupledPathSearchQueue } from "./CoupledPathSearchQueue"
import type {
  CoupledPathPoint,
  CoupledPathSearchResult,
  CoupledPathSearchState,
  PairLaneGeometry,
  Point,
} from "./types"

export const findCoupledPath = ({
  pair,
  geometry,
  params,
  positiveOriginal,
  negativeOriginal,
  drcChecker,
}: {
  pair: ResolvedDifferentialPair
  geometry: PairLaneGeometry
  params: ResolvedDifferentialPairPostProcessingParams
  positiveOriginal: PcbTraceForPostProcessing
  negativeOriginal: PcbTraceForPostProcessing
  drcChecker: DifferentialPairDrcChecker
}): CoupledPathSearchResult => {
  const maximumExploredStates = 80_000
  const directionVectors = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ] as const
  const canonicalLayers = ["top"] as PcbLayer[]
  for (let layerIndex = 1; layerIndex < params.layerCount - 1; layerIndex++) {
    canonicalLayers.push(`inner${layerIndex}` as PcbLayer)
  }
  if (params.layerCount > 1) canonicalLayers.push("bottom" as PcbLayer)
  const boardWidth = params.board.maxX - params.board.minX
  const boardHeight = params.board.maxY - params.board.minY
  const gridStep = Math.max(
    0.2,
    Math.sqrt((boardWidth * boardHeight * params.layerCount) / 45_000),
  )
  const maximumGridX = Math.floor(boardWidth / gridStep)
  const maximumGridY = Math.floor(boardHeight / gridStep)
  const minimumPairedViaSpacing = Math.max(
    geometry.effectiveMinimumSpacing,
    params.designRules.viaOuterDiameter +
      params.designRules.traceToTraceClearance,
  )
  const maximumViaPairBudget =
    minimumPairedViaSpacing > params.maxCenterlineSpacing + 1e-9
      ? 0
      : Math.min(Math.max(params.layerCount + 1, 2), 4)
  let totalExploredStateCount = 0
  let hitIterationLimit = false

  const getLaneOffsetForSegment = (start: Point, end: Point): Point => {
    const segmentVector = {
      x: end.x - start.x,
      y: end.y - start.y,
    }
    const segmentLength = Math.hypot(segmentVector.x, segmentVector.y)
    if (segmentLength <= 1e-12) return geometry.laneOffset
    return {
      x:
        (-segmentVector.y / segmentLength) *
        geometry.laneSideSign *
        geometry.targetSpacing *
        0.5,
      y:
        (segmentVector.x / segmentLength) *
        geometry.laneSideSign *
        geometry.targetSpacing *
        0.5,
    }
  }
  const getLanePoint = (
    midpoint: Point,
    polarity: 1 | -1,
    laneOffset: Point,
  ): Point => ({
    x: midpoint.x + laneOffset.x * polarity,
    y: midpoint.y + laneOffset.y * polarity,
  })
  const makeWire = (
    midpoint: Point,
    polarity: 1 | -1,
    laneOffset: Point,
    layer: PcbLayer,
    width: number,
  ): PcbTraceWireRoutePoint => ({
    route_type: "wire",
    ...getLanePoint(midpoint, polarity, laneOffset),
    width,
    layer,
  })
  const isSegmentValid = (
    start: Point,
    end: Point,
    layer: PcbLayer,
    isTerminalEscape = false,
  ): boolean => {
    const laneOffset = getLaneOffsetForSegment(start, end)
    const positiveViolation = drcChecker.getTraceSegmentViolation(
      makeWire(start, 1, laneOffset, layer, geometry.positiveWidth),
      makeWire(end, 1, laneOffset, layer, geometry.positiveWidth),
      isTerminalEscape,
    )
    if (positiveViolation) return false
    const negativeViolation = drcChecker.getTraceSegmentViolation(
      makeWire(start, -1, laneOffset, layer, geometry.negativeWidth),
      makeWire(end, -1, laneOffset, layer, geometry.negativeWidth),
      isTerminalEscape,
    )
    if (negativeViolation) return false
    const pairEnvelopeWidth =
      geometry.targetSpacing +
      Math.max(geometry.positiveWidth, geometry.negativeWidth)
    return !drcChecker.getTraceSegmentViolation(
      {
        route_type: "wire",
        ...start,
        width: pairEnvelopeWidth,
        layer,
      },
      {
        route_type: "wire",
        ...end,
        width: pairEnvelopeWidth,
        layer,
      },
      isTerminalEscape,
    )
  }
  const isViaPairValid = (
    midpoint: Point,
    laneOffset: Point,
    fromLayer: PcbLayer,
    toLayer: PcbLayer,
    viaPairBudget: number,
  ): boolean => {
    const layers = [fromLayer, toLayer]
    const positivePcbVia = {
      pcb_via_id:
        `pcb_via_${pair.name}_positive_search` as PcbViaForPostProcessing["pcb_via_id"],
      ...getLanePoint(midpoint, 1, laneOffset),
      outer_diameter: params.designRules.viaOuterDiameter,
      hole_diameter: params.designRules.viaHoleDiameter,
      layers,
      pcb_trace_id: positiveOriginal.pcb_trace_id,
      source_trace_id: positiveOriginal.source_trace_id,
    } satisfies PcbViaForPostProcessing
    const negativePcbVia = {
      pcb_via_id:
        `pcb_via_${pair.name}_negative_search` as PcbViaForPostProcessing["pcb_via_id"],
      ...getLanePoint(midpoint, -1, laneOffset),
      outer_diameter: params.designRules.viaOuterDiameter,
      hole_diameter: params.designRules.viaHoleDiameter,
      layers,
      pcb_trace_id: negativeOriginal.pcb_trace_id,
      source_trace_id: negativeOriginal.source_trace_id,
    } satisfies PcbViaForPostProcessing
    return !drcChecker.getViaPairViolation(
      positivePcbVia,
      negativePcbVia,
      geometry.effectiveMinimumSpacing,
      viaPairBudget,
    )
  }
  const getGridPoint = (gridX: number, gridY: number): Point => ({
    x: params.board.minX + gridX * gridStep,
    y: params.board.minY + gridY * gridStep,
  })
  const getNearbyGridCoordinates = (
    point: Point,
  ): Array<{ gridX: number; gridY: number }> => {
    const centerGridX = Math.round((point.x - params.board.minX) / gridStep)
    const centerGridY = Math.round((point.y - params.board.minY) / gridStep)
    const coordinates: Array<{ gridX: number; gridY: number }> = []
    for (let radius = 0; radius <= 3; radius++) {
      for (
        let gridY = centerGridY - radius;
        gridY <= centerGridY + radius;
        gridY++
      ) {
        for (
          let gridX = centerGridX - radius;
          gridX <= centerGridX + radius;
          gridX++
        ) {
          if (
            gridX < 0 ||
            gridX > maximumGridX ||
            gridY < 0 ||
            gridY > maximumGridY ||
            (radius > 0 &&
              Math.max(
                Math.abs(gridX - centerGridX),
                Math.abs(gridY - centerGridY),
              ) !== radius)
          ) {
            continue
          }
          coordinates.push({ gridX, gridY })
        }
      }
    }
    return coordinates
  }
  const reconstructPath = (
    goalState: CoupledPathSearchState,
  ): CoupledPathPoint[] => {
    const reversedPath: CoupledPathPoint[] = [
      { ...geometry.endMidpoint, layer: geometry.endLayer },
    ]
    let currentState: CoupledPathSearchState | undefined = goalState
    while (currentState) {
      reversedPath.push({
        x: currentState.x,
        y: currentState.y,
        layer: currentState.layer,
      })
      currentState = currentState.parent
    }
    reversedPath.push({
      ...geometry.startMidpoint,
      layer: geometry.startLayer,
    })
    const path = reversedPath.reverse()
    return path.filter((pathPoint, pathPointIndex) => {
      const previousPoint = path[pathPointIndex - 1]
      const nextPoint = path[pathPointIndex + 1]
      if (!previousPoint || !nextPoint) return true
      if (
        previousPoint.layer !== pathPoint.layer ||
        nextPoint.layer !== pathPoint.layer
      ) {
        return true
      }
      const firstVector = {
        x: pathPoint.x - previousPoint.x,
        y: pathPoint.y - previousPoint.y,
      }
      const secondVector = {
        x: nextPoint.x - pathPoint.x,
        y: nextPoint.y - pathPoint.y,
      }
      return (
        Math.abs(
          firstVector.x * secondVector.y - firstVector.y * secondVector.x,
        ) > 1e-9 ||
        firstVector.x * secondVector.x + firstVector.y * secondVector.y <= 0
      )
    })
  }

  if (
    geometry.startLayer === geometry.endLayer &&
    isSegmentValid(
      geometry.startMidpoint,
      geometry.endMidpoint,
      geometry.startLayer,
      true,
    )
  ) {
    return {
      status: "routed",
      path: [
        { ...geometry.startMidpoint, layer: geometry.startLayer },
        { ...geometry.endMidpoint, layer: geometry.endLayer },
      ],
      viaPairCount: 0,
      exploredStateCount: 0,
    }
  }

  for (
    let viaPairBudget = 0;
    viaPairBudget <= maximumViaPairBudget;
    viaPairBudget++
  ) {
    const openQueue = new CoupledPathSearchQueue()
    const bestPathLengthByState = new Map<string, number>()
    const startCoordinates = getNearbyGridCoordinates(geometry.startMidpoint)
    for (const { gridX, gridY } of startCoordinates) {
      const gridPoint = getGridPoint(gridX, gridY)
      if (
        !isSegmentValid(
          geometry.startMidpoint,
          gridPoint,
          geometry.startLayer,
          true,
        )
      ) {
        continue
      }
      const pathLength = Math.hypot(
        gridPoint.x - geometry.startMidpoint.x,
        gridPoint.y - geometry.startMidpoint.y,
      )
      const state: CoupledPathSearchState = {
        ...gridPoint,
        gridX,
        gridY,
        layer: geometry.startLayer,
        viaPairCount: 0,
        pathLength,
        score:
          pathLength +
          Math.hypot(
            geometry.endMidpoint.x - gridPoint.x,
            geometry.endMidpoint.y - gridPoint.y,
          ),
        directionIndex: -1,
      }
      const stateKey = `${gridX}:${gridY}:${state.layer}:0`
      bestPathLengthByState.set(stateKey, pathLength)
      openQueue.push(state)
    }

    let exploredForBudget = 0
    while (openQueue.length > 0 && exploredForBudget < maximumExploredStates) {
      const currentState = openQueue.pop()!
      exploredForBudget++
      totalExploredStateCount++
      if (
        currentState.layer === geometry.endLayer &&
        isSegmentValid(
          currentState,
          geometry.endMidpoint,
          geometry.endLayer,
          true,
        )
      ) {
        return {
          status: "routed",
          path: reconstructPath(currentState),
          viaPairCount: currentState.viaPairCount,
          exploredStateCount: totalExploredStateCount,
        }
      }

      for (
        let directionIndex = 0;
        directionIndex < directionVectors.length;
        directionIndex++
      ) {
        const direction = directionVectors[directionIndex]!
        const nextGridX = currentState.gridX + direction.x
        const nextGridY = currentState.gridY + direction.y
        if (
          nextGridX < 0 ||
          nextGridX > maximumGridX ||
          nextGridY < 0 ||
          nextGridY > maximumGridY
        ) {
          continue
        }
        const nextPoint = getGridPoint(nextGridX, nextGridY)
        if (!isSegmentValid(currentState, nextPoint, currentState.layer)) {
          continue
        }
        const segmentLength =
          gridStep * (direction.x !== 0 && direction.y !== 0 ? Math.SQRT2 : 1)
        const bendPenalty =
          currentState.directionIndex >= 0 &&
          currentState.directionIndex !== directionIndex
            ? gridStep * 0.02
            : 0
        const pathLength = currentState.pathLength + segmentLength + bendPenalty
        const stateKey = `${nextGridX}:${nextGridY}:${currentState.layer}:${currentState.viaPairCount}`
        if (
          (bestPathLengthByState.get(stateKey) ?? Number.POSITIVE_INFINITY) <=
          pathLength + 1e-9
        ) {
          continue
        }
        bestPathLengthByState.set(stateKey, pathLength)
        openQueue.push({
          ...nextPoint,
          gridX: nextGridX,
          gridY: nextGridY,
          layer: currentState.layer,
          viaPairCount: currentState.viaPairCount,
          pathLength,
          score:
            pathLength +
            Math.hypot(
              geometry.endMidpoint.x - nextPoint.x,
              geometry.endMidpoint.y - nextPoint.y,
            ),
          directionIndex,
          parent: currentState,
        })
      }

      if (currentState.viaPairCount >= viaPairBudget) continue
      for (const destinationLayer of canonicalLayers) {
        if (
          destinationLayer === currentState.layer ||
          !isViaPairValid(
            currentState,
            currentState.parent &&
              currentState.parent.layer === currentState.layer &&
              Math.hypot(
                currentState.x - currentState.parent.x,
                currentState.y - currentState.parent.y,
              ) > 1e-12
              ? getLaneOffsetForSegment(currentState.parent, currentState)
              : geometry.laneOffset,
            currentState.layer,
            destinationLayer,
            currentState.viaPairCount + 1,
          )
        ) {
          continue
        }
        const nextViaPairCount = currentState.viaPairCount + 1
        const pathLength = currentState.pathLength + gridStep * 0.05
        const stateKey = `${currentState.gridX}:${currentState.gridY}:${destinationLayer}:${nextViaPairCount}`
        if (
          (bestPathLengthByState.get(stateKey) ?? Number.POSITIVE_INFINITY) <=
          pathLength + 1e-9
        ) {
          continue
        }
        bestPathLengthByState.set(stateKey, pathLength)
        openQueue.push({
          ...currentState,
          layer: destinationLayer,
          viaPairCount: nextViaPairCount,
          pathLength,
          score:
            pathLength +
            Math.hypot(
              geometry.endMidpoint.x - currentState.x,
              geometry.endMidpoint.y - currentState.y,
            ),
          directionIndex: -1,
          parent: currentState,
        })
      }
    }
    if (exploredForBudget >= maximumExploredStates) hitIterationLimit = true
  }

  return {
    status: "failed",
    hitIterationLimit,
    exploredStateCount: totalExploredStateCount,
  }
}
