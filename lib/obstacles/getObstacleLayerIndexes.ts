import type { Obstacle } from "../types"

/** Resolve canonical obstacle layers, retaining compatibility with public z-layer indexes and names. */
export const getObstacleLayerIndexes = (
  obstacle: Obstacle,
  layerCount: number,
): number[] => {
  const canonicalLayers: unknown = obstacle.__zLayers
  const publicLayers: unknown = obstacle.zLayers
  const numericLayers =
    canonicalLayers !== undefined ? canonicalLayers : publicLayers
  if (numericLayers !== undefined) {
    if (
      !Array.isArray(numericLayers) ||
      numericLayers.length === 0 ||
      numericLayers.some(
        (index) => !Number.isInteger(index) || index < 0 || index >= layerCount,
      )
    )
      throw new Error("Obstacle has invalid z-layer indexes")
    return numericLayers
  }
  if (obstacle.layers.length === 0)
    throw new Error("Obstacle has no declared layers")
  return obstacle.layers.map((layer) => {
    if (layer === "top") return 0
    if (layer === "bottom") return layerCount - 1
    const match = /^inner(\d+)$/.exec(layer)
    const index = match ? Number(match[1]) : -1
    if (index <= 0 || index >= layerCount - 1)
      throw new Error(`Obstacle has invalid layer name "${layer}"`)
    return index
  })
}
