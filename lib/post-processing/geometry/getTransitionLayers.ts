import { getLayerIndex } from "./getLayerIndex"
import { getLayerName } from "./getLayerName"

/** Return every physical layer occupied by a through-layer transition. */
export const getTransitionLayers = (
  fromLayer: string,
  toLayer: string,
  layerCount: number,
): string[] => {
  const from = getLayerIndex(fromLayer, layerCount)
  const to = getLayerIndex(toLayer, layerCount)
  if (from < 0 || to < 0) return []
  const minimum = Math.min(from, to)
  const maximum = Math.max(from, to)
  return Array.from({ length: maximum - minimum + 1 }, (_, offset) =>
    getLayerName(minimum + offset, layerCount),
  )
}
