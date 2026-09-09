const COPPER_COORDINATE_TOLERANCE_MM = 1e-7

export const nearlyEqualCopperDimension = (a: number, b: number): boolean =>
  Math.abs(a - b) <= COPPER_COORDINATE_TOLERANCE_MM
