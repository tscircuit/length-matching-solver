import type { Obstacle } from "../../types"
import type { LengthMatchingColorTheme } from "./color-theme"
import { getGraphicsLayerForObstacle } from "./graphics-layers"
import type { LengthMatchingGraphics } from "./types"

/** Append board bounds and routed-obstacle graphics in the standard debug style. */
export const buildObstacleGraphics = (input: {
  obstacles: Obstacle[]
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  theme: LengthMatchingColorTheme
  graphics: LengthMatchingGraphics
}): void => {
  if (input.bounds) {
    const { minX, maxX, minY, maxY } = input.bounds
    input.graphics.rects.push({ center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, width: maxX - minX, height: maxY - minY, fill: input.theme.boardBounds.fill, stroke: input.theme.boardBounds.stroke, label: "board bounds", layer: `z${Array.from({ length: input.layerCount }, (_, z) => z).join(",")}` })
  }
  for (const obstacle of input.obstacles) input.graphics.rects.push({ center: obstacle.center, width: obstacle.width, height: obstacle.height, ccwRotationDegrees: obstacle.ccwRotationDegrees, fill: input.theme.obstacle.fill, stroke: input.theme.obstacle.stroke, layer: getGraphicsLayerForObstacle(obstacle, input.layerCount), label: obstacle.obstacleId ?? obstacle.componentId ?? "obstacle" })
}
