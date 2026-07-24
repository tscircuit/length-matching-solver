/**
 * Convert a numeric PCB layer into its graphics-debug layer identifier.
 */
export const getGraphicsLayerForRoute = (
  z: number,
): string => `z${z}`
