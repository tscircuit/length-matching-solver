import type {
  PcbLayer,
  PcbTraceForPostProcessing,
  PcbTraceRoutePoint,
  PcbTraceWireRoutePoint,
  PcbViaForPostProcessing,
  ResolvedDifferentialPair,
  ResolvedDifferentialPairPostProcessingParams,
} from "../types"
import type {
  CoupledPathPoint,
  PairLaneGeometry,
  Point,
  RoutedPairCandidate,
} from "./types"

export const createRoutedPairCandidate = ({
  pair,
  path,
  geometry,
  params,
  positiveOriginal,
  negativeOriginal,
  positiveOriginalStart,
  positiveOriginalEnd,
  negativeOriginalStart,
  negativeOriginalEnd,
}: {
  pair: ResolvedDifferentialPair
  path: CoupledPathPoint[]
  geometry: PairLaneGeometry
  params: ResolvedDifferentialPairPostProcessingParams
  positiveOriginal: PcbTraceForPostProcessing
  negativeOriginal: PcbTraceForPostProcessing
  positiveOriginalStart: PcbTraceWireRoutePoint
  positiveOriginalEnd: PcbTraceWireRoutePoint
  negativeOriginalStart: PcbTraceWireRoutePoint
  negativeOriginalEnd: PcbTraceWireRoutePoint
}): RoutedPairCandidate => {
  if (path.length < 2) {
    throw new Error(
      `Differential pair "${pair.name}" coupled path must contain at least two points`,
    )
  }
  const getLaneOffsetForEdge = (start: Point, end: Point): Point => {
    const edgeVector = { x: end.x - start.x, y: end.y - start.y }
    const edgeLength = Math.hypot(edgeVector.x, edgeVector.y)
    if (edgeLength <= 1e-12) {
      throw new Error(
        `Differential pair "${pair.name}" cannot derive a lane normal from a zero-length edge`,
      )
    }
    return {
      x:
        (-edgeVector.y / edgeLength) *
        geometry.laneSideSign *
        geometry.targetSpacing *
        0.5,
      y:
        (edgeVector.x / edgeLength) *
        geometry.laneSideSign *
        geometry.targetSpacing *
        0.5,
    }
  }
  const getLanePoint = (
    midpoint: Point,
    laneOffset: Point,
    polarity: 1 | -1,
  ): Point => ({
    x: midpoint.x + laneOffset.x * polarity,
    y: midpoint.y + laneOffset.y * polarity,
  })
  const positiveRoute: PcbTraceRoutePoint[] = [
    {
      ...positiveOriginalStart,
      width: geometry.positiveWidth,
      layer: geometry.startLayer,
      is_terminal_escape: true,
    },
  ]
  const negativeRoute: PcbTraceRoutePoint[] = [
    {
      ...negativeOriginalStart,
      width: geometry.negativeWidth,
      layer: geometry.startLayer,
      is_terminal_escape: true,
    },
  ]
  const pcbVias: PcbViaForPostProcessing[] = []
  let pairedTransitionIndex = 0

  const appendLaneStation = (
    midpoint: Point,
    laneOffset: Point,
    layer: PcbLayer,
    isTerminalEscape = false,
  ): void => {
    positiveRoute.push({
      route_type: "wire",
      ...getLanePoint(midpoint, laneOffset, 1),
      width: geometry.positiveWidth,
      layer,
      ...(isTerminalEscape ? { is_terminal_escape: true } : {}),
    })
    negativeRoute.push({
      route_type: "wire",
      ...getLanePoint(midpoint, laneOffset, -1),
      width: geometry.negativeWidth,
      layer,
      ...(isTerminalEscape ? { is_terminal_escape: true } : {}),
    })
  }
  const appendRoundedLaneTurn = (
    midpoint: Point,
    fromLaneOffset: Point,
    toLaneOffset: Point,
    layer: PcbLayer,
  ): void => {
    const fromAngle = Math.atan2(fromLaneOffset.y, fromLaneOffset.x)
    const toAngle = Math.atan2(toLaneOffset.y, toLaneOffset.x)
    let angleChange = toAngle - fromAngle
    while (angleChange > Math.PI) angleChange -= Math.PI * 2
    while (angleChange < -Math.PI) angleChange += Math.PI * 2
    if (Math.abs(angleChange) >= Math.PI - 1e-8) {
      throw new Error(
        `Differential pair "${pair.name}" coupled path contains a lane-reversing turn`,
      )
    }
    let stepCount = Math.max(
      1,
      Math.ceil(Math.abs(angleChange) / (Math.PI / 12)),
    )
    while (
      geometry.targetSpacing / Math.cos(Math.abs(angleChange) / stepCount / 2) >
        params.maxCenterlineSpacing + 1e-9 &&
      stepCount < 10_000
    ) {
      stepCount++
    }
    const angleStep = Math.abs(angleChange) / stepCount
    const expandedRadius = geometry.targetSpacing / 2 / Math.cos(angleStep / 2)
    appendLaneStation(
      midpoint,
      {
        x: Math.cos(fromAngle) * expandedRadius,
        y: Math.sin(fromAngle) * expandedRadius,
      },
      layer,
    )
    for (let stepIndex = 1; stepIndex <= stepCount; stepIndex++) {
      const angle = fromAngle + (angleChange * stepIndex) / stepCount
      appendLaneStation(
        midpoint,
        {
          x: Math.cos(angle) * expandedRadius,
          y: Math.sin(angle) * expandedRadius,
        },
        layer,
      )
    }
    appendLaneStation(midpoint, toLaneOffset, layer)
  }
  const getNextSpatialPathPoint = (
    pathPointIndex: number,
  ): CoupledPathPoint | undefined => {
    const pathPoint = path[pathPointIndex]!
    for (
      let nextPathPointIndex = pathPointIndex + 1;
      nextPathPointIndex < path.length;
      nextPathPointIndex++
    ) {
      const nextPathPoint = path[nextPathPointIndex]!
      if (
        Math.hypot(
          nextPathPoint.x - pathPoint.x,
          nextPathPoint.y - pathPoint.y,
        ) > 1e-12
      ) {
        return nextPathPoint
      }
    }
    return undefined
  }

  const firstSpatialPathPoint = getNextSpatialPathPoint(0)
  let currentLaneOffset = firstSpatialPathPoint
    ? getLaneOffsetForEdge(path[0]!, firstSpatialPathPoint)
    : geometry.laneOffset
  appendLaneStation(path[0]!, currentLaneOffset, path[0]!.layer, true)

  for (let pathPointIndex = 1; pathPointIndex < path.length; pathPointIndex++) {
    const previousPathPoint = path[pathPointIndex - 1]!
    const pathPoint = path[pathPointIndex]!
    const planarDistance = Math.hypot(
      pathPoint.x - previousPathPoint.x,
      pathPoint.y - previousPathPoint.y,
    )
    if (previousPathPoint.layer !== pathPoint.layer) {
      if (planarDistance > 1e-12) {
        throw new Error(
          `Differential pair "${pair.name}" changed layers while moving in the plane`,
        )
      }
      const positiveViaPoint = getLanePoint(pathPoint, currentLaneOffset, 1)
      const negativeViaPoint = getLanePoint(pathPoint, currentLaneOffset, -1)
      positiveRoute.push({
        route_type: "via",
        ...positiveViaPoint,
        from_layer: previousPathPoint.layer,
        to_layer: pathPoint.layer,
        hole_diameter: params.designRules.viaHoleDiameter,
        outer_diameter: params.designRules.viaOuterDiameter,
      })
      negativeRoute.push({
        route_type: "via",
        ...negativeViaPoint,
        from_layer: previousPathPoint.layer,
        to_layer: pathPoint.layer,
        hole_diameter: params.designRules.viaHoleDiameter,
        outer_diameter: params.designRules.viaOuterDiameter,
      })
      const viaLayers = [previousPathPoint.layer, pathPoint.layer]
      pcbVias.push(
        {
          pcb_via_id:
            `pcb_via_${pair.name}_positive_paired_transition_${pairedTransitionIndex}` as PcbViaForPostProcessing["pcb_via_id"],
          ...positiveViaPoint,
          outer_diameter: params.designRules.viaOuterDiameter,
          hole_diameter: params.designRules.viaHoleDiameter,
          layers: viaLayers,
          pcb_trace_id: positiveOriginal.pcb_trace_id,
          source_trace_id: positiveOriginal.source_trace_id,
        },
        {
          pcb_via_id:
            `pcb_via_${pair.name}_negative_paired_transition_${pairedTransitionIndex}` as PcbViaForPostProcessing["pcb_via_id"],
          ...negativeViaPoint,
          outer_diameter: params.designRules.viaOuterDiameter,
          hole_diameter: params.designRules.viaHoleDiameter,
          layers: viaLayers,
          pcb_trace_id: negativeOriginal.pcb_trace_id,
          source_trace_id: negativeOriginal.source_trace_id,
        },
      )
      pairedTransitionIndex++
      appendLaneStation(pathPoint, currentLaneOffset, pathPoint.layer)
      continue
    }
    if (planarDistance <= 1e-12) continue
    const edgeLaneOffset = getLaneOffsetForEdge(previousPathPoint, pathPoint)
    if (
      Math.hypot(
        edgeLaneOffset.x - currentLaneOffset.x,
        edgeLaneOffset.y - currentLaneOffset.y,
      ) > 1e-9
    ) {
      appendRoundedLaneTurn(
        previousPathPoint,
        currentLaneOffset,
        edgeLaneOffset,
        pathPoint.layer,
      )
    }
    appendLaneStation(pathPoint, edgeLaneOffset, pathPoint.layer)
    currentLaneOffset = edgeLaneOffset
  }

  const positiveLastWire = positiveRoute[
    positiveRoute.length - 1
  ] as PcbTraceWireRoutePoint
  const negativeLastWire = negativeRoute[
    negativeRoute.length - 1
  ] as PcbTraceWireRoutePoint
  positiveLastWire.is_terminal_escape = true
  negativeLastWire.is_terminal_escape = true
  positiveRoute.push({
    ...positiveOriginalEnd,
    width: geometry.positiveWidth,
    layer: geometry.endLayer,
    is_terminal_escape: true,
  })
  negativeRoute.push({
    ...negativeOriginalEnd,
    width: geometry.negativeWidth,
    layer: geometry.endLayer,
    is_terminal_escape: true,
  })
  return { positiveRoute, negativeRoute, pcbVias }
}
