import type { CopperSegment } from "../model/internal-types"
import { nearlyEqualCopperDimension } from "./nearlyEqualCopperDimension"
import { sameCopperPoint } from "./sameCopperPoint"

export const sameCopperSegment = (a: CopperSegment, b: CopperSegment): boolean => {
  if (a.layer !== b.layer) return false
  if (!nearlyEqualCopperDimension(a.width, b.width)) return false
  if (!sameCopperPoint(a.start, b.start)) return false
  if (!sameCopperPoint(a.end, b.end)) return false
  return true
}
