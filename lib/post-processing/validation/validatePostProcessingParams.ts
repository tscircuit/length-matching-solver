import { getObstacleLayerIndexes } from "../../obstacles/getObstacleLayerIndexes"
import { resolvePostProcessingGridConfig } from "../routing/resolvePostProcessingGridConfig"
import type { PostProcessingSolverParams } from "../types"

/** Validate the native HD-route boundary before creating any internal model. */
export function validatePostProcessingParams(
  params: PostProcessingSolverParams,
): void {
  if (!params || typeof params !== "object")
    throw new Error("PostProcessingSolver: params must be an object")
  if (!Array.isArray(params.hdRoutes))
    throw new Error("PostProcessingSolver: hdRoutes must be an array")
  if (!Array.isArray(params.differentialPairs))
    throw new Error("PostProcessingSolver: differentialPairs must be an array")
  if (!Array.isArray(params.obstacles))
    throw new Error("PostProcessingSolver: obstacles must be an array")
  if (!Number.isInteger(params.layerCount) || params.layerCount < 1)
    throw new Error(
      "PostProcessingSolver: layerCount must be a positive integer",
    )

  for (const obstacle of params.obstacles) {
    if (
      !obstacle ||
      typeof obstacle !== "object" ||
      obstacle.type !== "rect" ||
      !obstacle.center ||
      !Number.isFinite(obstacle.center.x) ||
      !Number.isFinite(obstacle.center.y) ||
      !Number.isFinite(obstacle.width) ||
      obstacle.width <= 0 ||
      !Number.isFinite(obstacle.height) ||
      obstacle.height <= 0 ||
      !Array.isArray(obstacle.layers) ||
      obstacle.layers.some((layer) => typeof layer !== "string") ||
      !Array.isArray(obstacle.connectedTo) ||
      obstacle.connectedTo.some(
        (connectionName) =>
          typeof connectionName !== "string" || connectionName.length === 0,
      ) ||
      (obstacle.ccwRotationDegrees !== undefined &&
        !Number.isFinite(obstacle.ccwRotationDegrees))
    )
      throw new Error("PostProcessingSolver: obstacle declaration is invalid")
    getObstacleLayerIndexes(obstacle, params.layerCount)
  }
  const { minX, maxX, minY, maxY } = params.bounds ?? {}
  if (
    ![minX, maxX, minY, maxY].every(Number.isFinite) ||
    minX >= maxX ||
    minY >= maxY
  )
    throw new Error(
      "PostProcessingSolver: bounds must have finite positive extents",
    )
  for (const defaultInnerGridStep of [0.25, 0.5])
    resolvePostProcessingGridConfig({
      config: params.routingGrid,
      bounds: params.bounds,
      defaultInnerGridStep,
    })

  for (const route of params.hdRoutes) {
    if (
      !route ||
      typeof route !== "object" ||
      typeof route.connectionName !== "string" ||
      route.connectionName.length === 0 ||
      (route.rootConnectionName !== undefined &&
        (typeof route.rootConnectionName !== "string" ||
          route.rootConnectionName.length === 0)) ||
      !Number.isFinite(route.traceThickness) ||
      route.traceThickness <= 0 ||
      !Number.isFinite(route.viaDiameter) ||
      route.viaDiameter < 0 ||
      (route.viaDiameter === 0 && !route.jumpers?.length) ||
      !Array.isArray(route.route) ||
      !Array.isArray(route.vias) ||
      (route.jumpers !== undefined && !Array.isArray(route.jumpers))
    )
      throw new Error("PostProcessingSolver: HD route declaration is invalid")
    if (
      (route.startPcbPortId !== undefined &&
        (typeof route.startPcbPortId !== "string" ||
          route.startPcbPortId.length === 0)) ||
      (route.endPcbPortId !== undefined &&
        (typeof route.endPcbPortId !== "string" ||
          route.endPcbPortId.length === 0))
    )
      throw new Error(
        `PostProcessingSolver: HD route "${route.connectionName}" has invalid terminal metadata`,
      )
    const transitionViaIndexes = new Set<number>()
    const transitionCountByViaIndex = new Map<number, number>()
    for (let pointIndex = 0; pointIndex < route.route.length; pointIndex++) {
      const point = route.route[pointIndex]
      if (
        !point ||
        typeof point !== "object" ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isInteger(point.z) ||
        point.z < 0 ||
        point.z >= params.layerCount ||
        (point.traceThickness !== undefined &&
          (!Number.isFinite(point.traceThickness) || point.traceThickness <= 0))
      )
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" has an invalid route point`,
        )
      if (
        point.pcb_port_id !== undefined &&
        (typeof point.pcb_port_id !== "string" ||
          point.pcb_port_id.length === 0 ||
          (pointIndex !== 0 && pointIndex !== route.route.length - 1))
      )
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" has unsupported PCB-port metadata`,
        )
      const next = route.route[pointIndex + 1]
      if (next !== undefined && (!next || typeof next !== "object"))
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" has an invalid route point`,
        )
      if (!next || next.z === point.z) {
        if (point.toNextSegmentType === "through_obstacle")
          throw new Error(
            `PostProcessingSolver: HD route "${route.connectionName}" has a through-obstacle marker without a layer transition`,
          )
        continue
      }
      if (point.toNextSegmentType === "through_obstacle") continue
      if (Math.hypot(point.x - next.x, point.y - next.y) > 1e-8)
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" moves in-plane while changing layers`,
        )
      const matchingViaIndexes = route.vias
        .map((via, viaIndex) => ({ via, viaIndex }))
        .filter(
          ({ via }) =>
            Boolean(via) &&
            typeof via === "object" &&
            Math.hypot(via.x - point.x, via.y - point.y) <= 1e-8,
        )
        .map(({ viaIndex }) => viaIndex)
      if (matchingViaIndexes.length !== 1)
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" must have exactly one via for each layer transition`,
        )
      const matchingViaIndex = matchingViaIndexes[0]!
      const matchingVia = route.vias[matchingViaIndex]!
      if (matchingVia.zLayers !== undefined) {
        const expectedLayers = Array.from(
          { length: Math.abs(next.z - point.z) + 1 },
          (_, index) => Math.min(point.z, next.z) + index,
        )
        const declaredLayers = Array.isArray(matchingVia.zLayers)
          ? [...new Set(matchingVia.zLayers)].sort((a, b) => a - b)
          : []
        if (
          !Array.isArray(matchingVia.zLayers) ||
          matchingVia.zLayers.length !== declaredLayers.length ||
          declaredLayers.length !== expectedLayers.length ||
          declaredLayers.some((z, index) => z !== expectedLayers[index])
        )
          throw new Error(
            `PostProcessingSolver: HD route "${route.connectionName}" has a via span incompatible with its layer transition`,
          )
      }
      transitionViaIndexes.add(matchingViaIndex)
      transitionCountByViaIndex.set(
        matchingViaIndex,
        (transitionCountByViaIndex.get(matchingViaIndex) ?? 0) + 1,
      )
    }
    for (let viaIndex = 0; viaIndex < route.vias.length; viaIndex++) {
      const via = route.vias[viaIndex]
      if (
        !via ||
        typeof via !== "object" ||
        !Number.isFinite(via.x) ||
        !Number.isFinite(via.y) ||
        (via.zLayers !== undefined &&
          (!Array.isArray(via.zLayers) ||
            via.zLayers.some(
              (z) => !Number.isInteger(z) || z < 0 || z >= params.layerCount,
            )))
      )
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" has an invalid via`,
        )
      if (!transitionViaIndexes.has(viaIndex))
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" has an unbound or ambiguous via`,
        )
      if ((transitionCountByViaIndex.get(viaIndex) ?? 0) > 1)
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" uses one physical via for multiple route transitions`,
        )
    }
    if (route.vias.length > 0 && route.viaDiameter <= 0)
      throw new Error(
        `PostProcessingSolver: HD route "${route.connectionName}" has a non-positive via diameter`,
      )
    if (
      route.startPcbPortId !== undefined &&
      route.route[0]?.pcb_port_id !== undefined &&
      route.startPcbPortId !== route.route[0].pcb_port_id
    )
      throw new Error(
        `PostProcessingSolver: HD route "${route.connectionName}" has conflicting start PCB-port metadata`,
      )
    if (
      route.endPcbPortId !== undefined &&
      route.route.at(-1)?.pcb_port_id !== undefined &&
      route.endPcbPortId !== route.route.at(-1)!.pcb_port_id
    )
      throw new Error(
        `PostProcessingSolver: HD route "${route.connectionName}" has conflicting end PCB-port metadata`,
      )
    for (const jumper of route.jumpers ?? []) {
      if (
        !jumper ||
        typeof jumper !== "object" ||
        jumper.route_type !== "jumper" ||
        !Number.isFinite(jumper.start?.x) ||
        !Number.isFinite(jumper.start?.y) ||
        !Number.isFinite(jumper.end?.x) ||
        !Number.isFinite(jumper.end?.y) ||
        !["0603", "1206", "1206x4_pair"].includes(jumper.footprint)
      )
        throw new Error(
          `PostProcessingSolver: HD route "${route.connectionName}" has an invalid jumper`,
        )
    }
  }

  const declaredConnections = new Set<string>()
  const claimedRouteIndexes = new Set<number>()
  for (const pair of params.differentialPairs) {
    if (
      !pair ||
      typeof pair !== "object" ||
      !Array.isArray(pair.connectionNames) ||
      pair.connectionNames.length !== 2 ||
      pair.connectionNames[0] === pair.connectionNames[1] ||
      !pair.connectionNames.every(
        (name) => typeof name === "string" && name.length > 0,
      ) ||
      !Number.isFinite(pair.lengthTolerance) ||
      pair.lengthTolerance < 0
    )
      throw new Error(
        "PostProcessingSolver: differential pair declaration is invalid",
      )
    for (const distance of [
      pair.minimumCenterlineDistance,
      pair.maximumCenterlineDistance,
    ])
      if (
        distance !== undefined &&
        (!Number.isFinite(distance) || distance <= 0)
      )
        throw new Error(
          "PostProcessingSolver: differential pair centerline distances must be positive finite numbers",
        )
    if (
      pair.minimumCenterlineDistance !== undefined &&
      pair.maximumCenterlineDistance !== undefined &&
      pair.minimumCenterlineDistance > pair.maximumCenterlineDistance
    )
      throw new Error(
        "PostProcessingSolver: differential pair minimumCenterlineDistance cannot exceed maximumCenterlineDistance",
      )
    for (const connectionName of pair.connectionNames) {
      if (declaredConnections.has(connectionName))
        throw new Error(
          `PostProcessingSolver: connection "${connectionName}" belongs to multiple differential pairs`,
        )
      declaredConnections.add(connectionName)
      const matches = params.hdRoutes
        .map((route, routeIndex) => ({ route, routeIndex }))
        .filter(({ route }) => route.connectionName === connectionName)
      if (matches.length !== 1)
        throw new Error(
          `PostProcessingSolver: differential pair connection "${connectionName}" must resolve to exactly one HD route, got ${matches.length}`,
        )
      const match = matches[0]!
      if (claimedRouteIndexes.has(match.routeIndex))
        throw new Error(
          `PostProcessingSolver: differential pair connection "${connectionName}" ambiguously resolves to an already claimed HD route`,
        )
      claimedRouteIndexes.add(match.routeIndex)
      if (
        match.route.route.length < 2 ||
        match.route.viaDiameter <= 0 ||
        match.route.jumpers?.length ||
        match.route.route.some(
          (point) =>
            point.insideJumperPad ||
            point.toNextSegmentType === "through_obstacle",
        )
      )
        throw new Error(
          `PostProcessingSolver: differential pair connection "${connectionName}" has unsupported HD geometry`,
        )
    }
  }
}
