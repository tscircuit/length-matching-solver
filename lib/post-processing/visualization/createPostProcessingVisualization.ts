import type { GraphicsObject } from "graphics-debug"
import { getObstacleLayerIndexes } from "../../obstacles/getObstacleLayerIndexes"
import type { Obstacle, SimplifiedPcbTrace } from "../../types"
import { getLayerIndex } from "../geometry/getLayerIndex"
import { getTransitionLayers } from "../geometry/getTransitionLayers"

/** Build a layer-aware debug view of immutable obstacles and current pair output. */
export const createPostProcessingVisualization = (input: {
  traces: SimplifiedPcbTrace[]
  obstacles: Obstacle[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  layerCount: number
  activeConnectionNames: [string, string] | null
  previewPath: Array<{ x: number; y: number; layer: string }> | null
}): GraphicsObject => {
  const graphics: GraphicsObject = {
    lines: [],
    points: [],
    rects: [],
    circles: [],
  }
  graphics.rects!.push({
    center: {
      x: (input.bounds.minX + input.bounds.maxX) / 2,
      y: (input.bounds.minY + input.bounds.maxY) / 2,
    },
    width: input.bounds.maxX - input.bounds.minX,
    height: input.bounds.maxY - input.bounds.minY,
    fill: "rgba(30, 70, 120, 0.04)",
    stroke: "rgba(30, 70, 120, 0.55)",
    layer: `z${Array.from({ length: input.layerCount }, (_, index) => index).join(",")}`,
  })
  for (const obstacle of input.obstacles) {
    const indexes = getObstacleLayerIndexes(obstacle, input.layerCount)
    graphics.rects!.push({
      center: obstacle.center,
      width: obstacle.width,
      height: obstacle.height,
      ccwRotationDegrees: obstacle.ccwRotationDegrees,
      fill: "rgba(220, 60, 60, 0.16)",
      stroke: "rgba(190, 40, 40, 0.75)",
      layer: `z${indexes.join(",")}`,
    })
  }
  for (let index = 0; index < (input.previewPath?.length ?? 0) - 1; index++) {
    const start = input.previewPath![index]!
    const end = input.previewPath![index + 1]!
    if (start.layer !== end.layer) continue
    const z = getLayerIndex(start.layer, input.layerCount)
    graphics.lines!.push({
      points: [start, end],
      strokeColor: "#16a34a",
      strokeWidth: 0.08,
      strokeDash: [0.18, 0.12],
      layer: `z${z}`,
    })
  }
  for (const trace of input.traces) {
    if (input.activeConnectionNames?.includes(trace.connection_name)) continue
    const color = "#2563eb"
    let current: { x: number; y: number; layer: string; width: number } | null =
      null
    for (const entry of trace.route) {
      if (entry.route_type === "wire") {
        if (current && current.layer === entry.layer) {
          const z = getLayerIndex(entry.layer, input.layerCount)
          graphics.lines!.push({
            points: [current, entry],
            strokeColor: color,
            strokeWidth: Math.max(current.width, entry.width),
            ...(z === 0 ? {} : { strokeDash: [0.2, 0.16] }),
            layer: `z${z}`,
          })
        }
        current = entry
      } else if (entry.route_type === "via") {
        const layers = getTransitionLayers(
          entry.from_layer,
          entry.to_layer,
          input.layerCount,
        ).map((layer) => getLayerIndex(layer, input.layerCount))
        graphics.circles!.push({
          center: entry,
          radius: (entry.via_diameter ?? current?.width ?? 0.2) / 2,
          fill: "rgba(37, 99, 235, 0.45)",
          stroke: color,
          layer: `z${layers.join(",")}`,
        })
        if (current) {
          const previousWidth: number = current.width
          current = {
            x: entry.x,
            y: entry.y,
            layer: entry.to_layer,
            width: previousWidth,
          }
        }
      }
    }
  }
  return graphics
}
