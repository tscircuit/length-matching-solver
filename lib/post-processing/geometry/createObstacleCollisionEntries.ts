import { getObstacleLayerIndexes } from "../../obstacles/getObstacleLayerIndexes"
import type { Obstacle } from "../../types"

export type ObstacleCollisionEntry = {
  obstacle: Obstacle
  layerIndexes: number[]
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const createObstacleCollisionEntries = (input: {
  obstacles: Obstacle[]
  layerCount: number
}): ObstacleCollisionEntry[] => {
  return input.obstacles.map((obstacle) => {
    const ccwRotationRadians =
      ((obstacle.ccwRotationDegrees ?? 0) * Math.PI) / 180
    const absoluteCosine = Math.abs(Math.cos(ccwRotationRadians))
    const absoluteSine = Math.abs(Math.sin(ccwRotationRadians))
    const halfAxisWidth =
      (absoluteCosine * obstacle.width + absoluteSine * obstacle.height) / 2
    const halfAxisHeight =
      (absoluteSine * obstacle.width + absoluteCosine * obstacle.height) / 2
    return {
      obstacle,
      layerIndexes: getObstacleLayerIndexes(obstacle, input.layerCount),
      minX: obstacle.center.x - halfAxisWidth,
      maxX: obstacle.center.x + halfAxisWidth,
      minY: obstacle.center.y - halfAxisHeight,
      maxY: obstacle.center.y + halfAxisHeight,
    }
  })
}
