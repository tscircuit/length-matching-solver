import type { CopperVia } from "../model/internal-types"
import { nearlyEqualCopperDimension } from "./nearlyEqualCopperDimension"
import { sameCopperPoint } from "./sameCopperPoint"

export const sameCopperVia = (a: CopperVia, b: CopperVia): boolean => {
  if (!sameCopperPoint(a, b)) return false
  if (!nearlyEqualCopperDimension(a.diameter, b.diameter)) return false
  if (a.layers.length !== b.layers.length) return false
  if (!a.layers.every((layer) => b.layers.includes(layer))) return false
  return true
}
