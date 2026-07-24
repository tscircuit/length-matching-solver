import type { LengthMatchingConfig } from "../internal-types"
import type { LengthMatchingSolverParams } from "../types"

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
  return {
    maximumMeanderDepth,
    minimumToothPitch: params.minimumToothPitch,
    minMeanderGap: params.minMeanderGap,
    minMeanderHeight: params.minMeanderHeight,
    maxToothCount,
    obstacles: params.obstacles ?? [],
    bounds: params.bounds,
    obstacleMargin: params.obstacleMargin ?? 0.15,
    layerCount: params.layerCount ?? 2,
    colorMap: params.colorMap ?? {},
  }
}
