import type { SimplifiedPcbTraces } from "../../types"

/**
 * Clone route entries and endpoint metadata without retaining mutable geometry
 * references supplied by the caller.
 */
export const cloneSimplifiedPcbTraces = (
  traces: SimplifiedPcbTraces,
): SimplifiedPcbTraces => structuredClone(traces)
