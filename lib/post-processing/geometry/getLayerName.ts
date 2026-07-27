/** Map a zero-based physical layer index to its canonical PCB layer name. */
export const getLayerName = (index: number, layerCount: number): string => {
  if (index === 0) return "top"
  if (index === layerCount - 1) return "bottom"
  return `inner${index}`
}
