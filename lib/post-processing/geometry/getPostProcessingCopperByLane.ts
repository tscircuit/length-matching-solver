import type {
  CopperSegment,
  CopperVia,
  PostProcessingTrace,
} from "../model/internal-types"
import { getTraceCopperGeometry } from "../model/getTraceCopperGeometry"
import { getLayerIndex } from "./getLayerIndex"

export type PostProcessingCopper = {
  segments: CopperSegment[]
  segmentsByLayer: CopperSegment[][]
  vias: CopperVia[]
}

export function getPostProcessingCopperByLane(
  traces: PostProcessingTrace[],
  layerCount: number,
  firstRoot: string | undefined,
  secondRoot: string | undefined,
): { first: PostProcessingCopper; second: PostProcessingCopper } {
  const copper = traces.map((trace) => ({
    root: trace.rootConnectionName,
    ...getTraceCopperGeometry(trace, layerCount),
  }))
  const groupCopper = (rootToExclude?: string): PostProcessingCopper => {
    const segments: CopperSegment[] = []
    const vias: CopperVia[] = []
    const segmentsByLayer = Array.from(
      { length: layerCount },
      (): CopperSegment[] => [],
    )
    for (const trace of copper) {
      if (rootToExclude !== undefined && rootToExclude === trace.root) continue
      for (const segment of trace.segments) {
        segments.push(segment)
        segmentsByLayer[getLayerIndex(segment.layer, layerCount)]!.push(segment)
      }
      vias.push(...trace.vias)
    }
    return { segments, segmentsByLayer, vias }
  }

  const all = groupCopper()
  // The same immutable geometry serves both lanes unless a lane has
  // independently routed copper belonging to its own net.
  return {
    first:
      firstRoot !== undefined && copper.some(({ root }) => root === firstRoot)
        ? groupCopper(firstRoot)
        : all,
    second:
      secondRoot !== undefined && copper.some(({ root }) => root === secondRoot)
        ? groupCopper(secondRoot)
        : all,
  }
}
