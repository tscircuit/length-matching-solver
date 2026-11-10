import { getTraceCopperGeometry } from "../../post-processing/model/getTraceCopperGeometry"
import type { LengthMatchingConfig } from "../internal-types"
import type { LengthMatchingSolverParams } from "../types"
import { LengthMatchingConstraintError } from "../errors/LengthMatchingConstraintError"
import { validatePair } from "./validatePair"

/** Validate public options once and resolve defaults for every internal module. */
export const validateAndResolveParams = (
  params: LengthMatchingSolverParams,
): LengthMatchingConfig => {
  const maximumMeanderDepth = params.maximumMeanderDepth ?? 5
  const maxToothCount = params.maxToothCount ?? 12
  if (!Number.isFinite(maximumMeanderDepth) || maximumMeanderDepth <= 0) {
    throw new Error(
      "LengthMatchingSolver: maximumMeanderDepth must be a positive finite number",
    )
  }
  if (
    params.minimumToothPitch !== undefined &&
    (!Number.isFinite(params.minimumToothPitch) ||
      params.minimumToothPitch <= 0)
  ) {
    throw new Error(
      "LengthMatchingSolver: minimumToothPitch must be a positive finite number",
    )
  }
  if (
    params.minMeanderGap !== undefined &&
    (!Number.isFinite(params.minMeanderGap) || params.minMeanderGap <= 0)
  ) {
    throw new Error(
      "LengthMatchingSolver: minMeanderGap must be a positive finite number",
    )
  }
  if (
    params.minMeanderHeight !== undefined &&
    (!Number.isFinite(params.minMeanderHeight) || params.minMeanderHeight <= 0)
  ) {
    throw new Error(
      "LengthMatchingSolver: minMeanderHeight must be a positive finite number",
    )
  }
  if (
    params.minMeanderHeight !== undefined &&
    params.minMeanderHeight > maximumMeanderDepth
  ) {
    throw new Error(
      "LengthMatchingSolver: minMeanderHeight cannot exceed maximumMeanderDepth",
    )
  }
  if (
    !Number.isFinite(maxToothCount) ||
    !Number.isInteger(maxToothCount) ||
    maxToothCount <= 0
  ) {
    throw new Error(
      "LengthMatchingSolver: maxToothCount must be a positive finite integer",
    )
  }
  const layerCount = params.layerCount ?? 2
  const seen = new Set<string>()
  for (const [pairIndex, pair] of (params.differentialPairs ?? []).entries()) {
    validatePair(
      pair,
      params.originalConnections,
      params.hdRoutes,
      layerCount,
      pairIndex,
    )
    for (const name of pair.connectionNames.flat()) {
      if (seen.has(name))
        throw new LengthMatchingConstraintError(
          pairIndex,
          "invalid-input",
          `hop "${name}" belongs to multiple pairs`,
        )
      seen.add(name)
    }
  }
  for (const trace of params.traces ?? []) {
    getTraceCopperGeometry(trace, layerCount)
  }
  return {
    maximumMeanderDepth,
    minimumToothPitch: params.minimumToothPitch,
    minMeanderGap: params.minMeanderGap,
    minMeanderHeight: params.minMeanderHeight,
    maxToothCount,
    traces: params.traces ?? [],
    obstacles: params.obstacles ?? [],
    bounds: params.bounds,
    obstacleMargin: params.obstacleMargin ?? 0.15,
    layerCount,
    colorMap: params.colorMap ?? {},
  }
}
