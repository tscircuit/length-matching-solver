import { getTraceCopperGeometry } from "../../post-processing/model/getTraceCopperGeometry"
import type {
  CopperSegment,
  CopperVia,
} from "../../post-processing/model/internal-types"
import type { SimplifiedPcbTraces } from "../../types"

export type TraceCopperIndex = {
  segmentsByLayer: Map<string, CopperSegment[]>
  viasByLayer: Map<string, CopperVia[]>
}

const indexCache = new WeakMap<
  SimplifiedPcbTraces,
  Map<number, TraceCopperIndex>
>()

/**
 * Group fixed-trace copper by layer, reusing the result while the traces array
 * identity and layer count are unchanged.
 */
export const getTraceCopperIndex = (
  traces: SimplifiedPcbTraces,
  layerCount: number,
): TraceCopperIndex => {
  const cachedByLayerCount = indexCache.get(traces)
  const cachedIndex = cachedByLayerCount?.get(layerCount)
  if (cachedIndex) return cachedIndex
  const segmentsByLayer = new Map<string, CopperSegment[]>()
  const viasByLayer = new Map<string, CopperVia[]>()
  for (const trace of traces) {
    const { segments, vias } = getTraceCopperGeometry(trace, layerCount)
    for (const segment of segments) {
      const layerSegments = segmentsByLayer.get(segment.layer)
      if (layerSegments) layerSegments.push(segment)
      else segmentsByLayer.set(segment.layer, [segment])
    }
    for (const via of vias) {
      for (const layer of via.layers) {
        const layerVias = viasByLayer.get(layer)
        if (layerVias) layerVias.push(via)
        else viasByLayer.set(layer, [via])
      }
    }
  }
  const index: TraceCopperIndex = { segmentsByLayer, viasByLayer }
  if (cachedByLayerCount) cachedByLayerCount.set(layerCount, index)
  else indexCache.set(traces, new Map([[layerCount, index]]))
  return index
}
