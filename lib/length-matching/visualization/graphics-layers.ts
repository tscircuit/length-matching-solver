import type { Obstacle } from "../../types"

export const getGraphicsLayerForRoute = (z: number): string => `z${z}`

/** Convert obstacle PCB layer names into the graphics-debug layer format. */
export const getGraphicsLayerForObstacle = (
  obstacle: Obstacle,
  layerCount: number,
): string => {
  const layers = obstacle.layers.map((layerName) => {
    if (layerName === "top") return 0
    if (layerName === "bottom") return layerCount - 1
    const innerLayerIndex = Number.parseInt(layerName.replace("inner", ""), 10)
    if (!Number.isInteger(innerLayerIndex))
      throw new Error(`LengthMatchingSolver: unknown layer name "${layerName}"`)
    return innerLayerIndex
  })
  return `z${layers.join(",")}`
}
