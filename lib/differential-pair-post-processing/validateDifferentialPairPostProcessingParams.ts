import {
  DEFAULT_MAX_DIFFERENTIAL_PAIR_CENTERLINE_SPACING_MM,
  DEFAULT_MIN_DIFFERENTIAL_PAIR_CENTERLINE_SPACING_MM,
} from "./constants"
import { DifferentialPairInputError } from "./DifferentialPairInputError"
import type {
  DifferentialPairPostProcessingSolverParams,
  PcbLayer,
  ResolvedDifferentialPairPostProcessingParams,
} from "./types"

export const validateDifferentialPairPostProcessingParams = (
  params: DifferentialPairPostProcessingSolverParams,
): ResolvedDifferentialPairPostProcessingParams => {
  const finiteNonnegativeRuleNames = [
    "traceToTraceClearance",
    "traceToObstacleClearance",
    "viaToTraceClearance",
    "viaToObstacleClearance",
    "boardEdgeClearance",
    "viaHoleDiameter",
    "viaOuterDiameter",
  ] as const
  const isFinitePoint = (point: { x: number; y: number }): boolean =>
    Number.isFinite(point.x) && Number.isFinite(point.y)
  const getCanonicalLayers = (layerCount: number): PcbLayer[] => {
    const layers = ["top"] as PcbLayer[]
    for (let layerIndex = 1; layerIndex < layerCount - 1; layerIndex++)
      layers.push(`inner${layerIndex}` as PcbLayer)
    if (layerCount > 1) layers.push("bottom" as PcbLayer)
    return layers
  }
  if (!Number.isInteger(params.layerCount) || params.layerCount < 1)
    throw new DifferentialPairInputError(
      "invalid_layer_count",
      `DifferentialPairPostProcessingSolver: layerCount must be a positive integer, received ${params.layerCount}`,
    )
  const boardValues = Object.values(params.board)
  if (
    boardValues.some((value) => !Number.isFinite(value)) ||
    params.board.minX >= params.board.maxX ||
    params.board.minY >= params.board.maxY
  )
    throw new DifferentialPairInputError(
      "invalid_board",
      "DifferentialPairPostProcessingSolver: board bounds must be finite and non-empty",
    )
  for (const ruleName of finiteNonnegativeRuleNames) {
    const ruleValue = params.designRules[ruleName]
    if (!Number.isFinite(ruleValue) || ruleValue < 0)
      throw new DifferentialPairInputError(
        "invalid_design_rule",
        `DifferentialPairPostProcessingSolver: designRules.${ruleName} must be finite and nonnegative`,
      )
  }
  if (params.designRules.viaOuterDiameter < params.designRules.viaHoleDiameter)
    throw new DifferentialPairInputError(
      "invalid_design_rule",
      "DifferentialPairPostProcessingSolver: viaOuterDiameter must be at least viaHoleDiameter",
    )
  const minCenterlineSpacing =
    params.minCenterlineSpacing ??
    DEFAULT_MIN_DIFFERENTIAL_PAIR_CENTERLINE_SPACING_MM
  const maxCenterlineSpacing =
    params.maxCenterlineSpacing ??
    DEFAULT_MAX_DIFFERENTIAL_PAIR_CENTERLINE_SPACING_MM
  if (
    !Number.isFinite(minCenterlineSpacing) ||
    !Number.isFinite(maxCenterlineSpacing) ||
    minCenterlineSpacing <= 0 ||
    maxCenterlineSpacing < minCenterlineSpacing
  )
    throw new DifferentialPairInputError(
      "invalid_design_rule",
      "DifferentialPairPostProcessingSolver: centerline spacing bounds must be finite, positive, and ordered",
    )
  const canonicalLayerNames = new Set(getCanonicalLayers(params.layerCount))
  const sourceTraceIds = new Set<string>()
  const pcbTraceIds = new Set<string>()
  for (const pcbTrace of params.pcbTraces) {
    if (pcbTraceIds.has(pcbTrace.pcb_trace_id))
      throw new DifferentialPairInputError(
        "invalid_geometry",
        `DifferentialPairPostProcessingSolver: duplicate PCB trace id "${pcbTrace.pcb_trace_id}"`,
      )
    pcbTraceIds.add(pcbTrace.pcb_trace_id)
    sourceTraceIds.add(pcbTrace.source_trace_id)
    const wirePoints = pcbTrace.route.filter(
      (routePoint) => routePoint.route_type === "wire",
    )
    if (
      wirePoints.length < 2 ||
      pcbTrace.route.some((routePoint) => {
        if (routePoint.route_type === "through_pad")
          return (
            !isFinitePoint(routePoint.start) ||
            !isFinitePoint(routePoint.end) ||
            !Number.isFinite(routePoint.width) ||
            routePoint.width <= 0 ||
            !canonicalLayerNames.has(routePoint.start_layer) ||
            !canonicalLayerNames.has(routePoint.end_layer)
          )
        return (
          !isFinitePoint(routePoint) ||
          (routePoint.route_type === "wire" &&
            (!Number.isFinite(routePoint.width) ||
              routePoint.width <= 0 ||
              !canonicalLayerNames.has(routePoint.layer))) ||
          (routePoint.route_type === "via" &&
            (!canonicalLayerNames.has(routePoint.from_layer) ||
              !canonicalLayerNames.has(routePoint.to_layer)))
        )
      })
    )
      throw new DifferentialPairInputError(
        "invalid_geometry",
        `DifferentialPairPostProcessingSolver: PCB trace "${pcbTrace.pcb_trace_id}" has invalid or incomplete route geometry`,
      )
  }
  const pcbViaIds = new Set<string>()
  for (const pcbVia of params.pcbVias) {
    if (
      pcbViaIds.has(pcbVia.pcb_via_id) ||
      !isFinitePoint(pcbVia) ||
      !Number.isFinite(pcbVia.outer_diameter) ||
      !Number.isFinite(pcbVia.hole_diameter) ||
      pcbVia.hole_diameter <= 0 ||
      pcbVia.outer_diameter < pcbVia.hole_diameter ||
      pcbVia.layers.length < 2 ||
      pcbVia.layers.some((layer) => !canonicalLayerNames.has(layer))
    )
      throw new DifferentialPairInputError(
        "invalid_geometry",
        `DifferentialPairPostProcessingSolver: PCB via "${pcbVia.pcb_via_id}" has invalid geometry or identifier`,
      )
    pcbViaIds.add(pcbVia.pcb_via_id)
  }
  const obstacleIds = new Set<string>()
  for (const obstacle of params.obstacles) {
    const hasInvalidShape =
      obstacle.type === "circle"
        ? !Number.isFinite(obstacle.radius) || obstacle.radius <= 0
        : !Number.isFinite(obstacle.width) ||
          obstacle.width <= 0 ||
          !Number.isFinite(obstacle.height) ||
          obstacle.height <= 0
    if (
      obstacleIds.has(obstacle.obstacle_id) ||
      !isFinitePoint(obstacle.center) ||
      obstacle.layers.length === 0 ||
      obstacle.layers.some((layer) => !canonicalLayerNames.has(layer)) ||
      (obstacle.clearance !== undefined &&
        (!Number.isFinite(obstacle.clearance) || obstacle.clearance < 0)) ||
      hasInvalidShape
    )
      throw new DifferentialPairInputError(
        "invalid_geometry",
        `DifferentialPairPostProcessingSolver: obstacle "${obstacle.obstacle_id}" has invalid geometry or identifier`,
      )
    obstacleIds.add(obstacle.obstacle_id)
  }
  const pairNames = new Set<string>()
  const pairedSourceTraceIds = new Set<string>()
  for (const differentialPair of params.differentialPairs) {
    if (pairNames.has(differentialPair.name))
      throw new DifferentialPairInputError(
        "duplicate_pair_name",
        `DifferentialPairPostProcessingSolver: duplicate differential-pair name "${differentialPair.name}"`,
      )
    pairNames.add(differentialPair.name)
    if (
      differentialPair.positiveSourceTraceId ===
        differentialPair.negativeSourceTraceId ||
      !Number.isFinite(differentialPair.maxLengthSkew) ||
      differentialPair.maxLengthSkew < 0
    )
      throw new DifferentialPairInputError(
        "invalid_pair",
        `DifferentialPairPostProcessingSolver: differential pair "${differentialPair.name}" has invalid membership or skew`,
      )
    for (const sourceTraceId of [
      differentialPair.positiveSourceTraceId,
      differentialPair.negativeSourceTraceId,
    ]) {
      if (!sourceTraceIds.has(sourceTraceId))
        throw new DifferentialPairInputError(
          "missing_pair_trace",
          `DifferentialPairPostProcessingSolver: differential pair "${differentialPair.name}" is missing PCB trace "${sourceTraceId}"`,
        )
      if (pairedSourceTraceIds.has(sourceTraceId))
        throw new DifferentialPairInputError(
          "invalid_pair",
          `DifferentialPairPostProcessingSolver: source trace "${sourceTraceId}" belongs to more than one differential pair`,
        )
      pairedSourceTraceIds.add(sourceTraceId)
    }
  }
  return {
    ...params,
    pcbTraces: params.pcbTraces
      .map((pcbTrace) => structuredClone(pcbTrace))
      .sort((traceA, traceB) =>
        traceA.pcb_trace_id < traceB.pcb_trace_id
          ? -1
          : traceA.pcb_trace_id > traceB.pcb_trace_id
            ? 1
            : 0,
      ),
    pcbVias: params.pcbVias
      .map((pcbVia) => structuredClone(pcbVia))
      .sort((viaA, viaB) =>
        viaA.pcb_via_id < viaB.pcb_via_id
          ? -1
          : viaA.pcb_via_id > viaB.pcb_via_id
            ? 1
            : 0,
      ),
    obstacles: params.obstacles
      .map((obstacle) => structuredClone(obstacle))
      .sort((obstacleA, obstacleB) =>
        obstacleA.obstacle_id < obstacleB.obstacle_id
          ? -1
          : obstacleA.obstacle_id > obstacleB.obstacle_id
            ? 1
            : 0,
      ),
    differentialPairs: params.differentialPairs
      .map((differentialPair) => structuredClone(differentialPair))
      .sort((pairA, pairB) =>
        pairA.name < pairB.name ? -1 : pairA.name > pairB.name ? 1 : 0,
      ),
    minCenterlineSpacing,
    maxCenterlineSpacing,
  }
}
