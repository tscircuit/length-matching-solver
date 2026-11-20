import type { DifferentialPair } from "../../types"

export function hasPairSpacingPreference(pair: DifferentialPair): boolean {
  return (
    pair.minimumCenterlineDistance !== undefined ||
    pair.maximumCenterlineDistance !== undefined
  )
}
