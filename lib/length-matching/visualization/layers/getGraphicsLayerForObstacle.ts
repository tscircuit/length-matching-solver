import { getObstacleLayerIndexes } from "../../../obstacles/getObstacleLayerIndexes"
import type { Obstacle } from "../../../types"

/** Convert obstacle PCB layer names into the graphics-debug layer format. */
export const getGraphicsLayerForObstacle = (
  obstacle: Obstacle,
  layerCount: number,
): string => {
  const indexes = getObstacleLayerIndexes(obstacle, layerCount)
  return `z${indexes.join(",")}`
}
