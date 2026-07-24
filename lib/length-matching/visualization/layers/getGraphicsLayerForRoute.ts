/**
 * Convert a numeric PCB layer into its graphics-debug layer identifier.
 *
 * Route graphics consistently use the `z<number>` naming convention.
 */
export const getGraphicsLayerForRoute = (z: number): string => `z${z}`
