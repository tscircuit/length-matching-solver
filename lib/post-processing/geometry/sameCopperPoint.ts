import type { Point } from "../model/internal-types"
import { nearlyEqualCopperDimension } from "./nearlyEqualCopperDimension"

export const sameCopperPoint = (a: Point, b: Point): boolean =>
  nearlyEqualCopperDimension(a.x, b.x) && nearlyEqualCopperDimension(a.y, b.y)
