/** Map canonical PCB layer names to zero-based physical layer indexes. */
export const getLayerIndex = (layer: string, layerCount: number): number => {
  if (layer === "top") return 0
  if (layer === "bottom") return layerCount - 1
  const match = /^inner(\d+)$/.exec(layer)
  if (!match) return -1
  const index = Number(match[1])
  return index > 0 && index < layerCount - 1 ? index : -1
}
