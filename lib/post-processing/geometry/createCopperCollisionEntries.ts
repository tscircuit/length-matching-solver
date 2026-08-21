import type { CopperSegment, CopperVia } from "../model/internal-types"
import { getLayerIndex } from "./getLayerIndex"

export type CopperSegmentCollisionEntry = {
  segment: CopperSegment
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type CopperViaCollisionEntry = {
  via: CopperVia
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const createCopperCollisionEntries = (input: {
  segments: CopperSegment[]
  vias: CopperVia[]
  layerCount: number
}): {
  segmentsByLayer: CopperSegmentCollisionEntry[][]
  viasByLayer: CopperViaCollisionEntry[][]
  vias: CopperViaCollisionEntry[]
} => {
  const segmentsByLayer = Array.from(
    { length: input.layerCount },
    (): CopperSegmentCollisionEntry[] => [],
  )
  for (const segment of input.segments) {
    const layerIndex = getLayerIndex(segment.layer, input.layerCount)
    segmentsByLayer[layerIndex]!.push({
      segment,
      minX: Math.min(segment.start.x, segment.end.x),
      maxX: Math.max(segment.start.x, segment.end.x),
      minY: Math.min(segment.start.y, segment.end.y),
      maxY: Math.max(segment.start.y, segment.end.y),
    })
  }

  const viasByLayer = Array.from(
    { length: input.layerCount },
    (): CopperViaCollisionEntry[] => [],
  )
  const vias = input.vias.map((via) => {
    const entry = {
      via,
      minX: via.x,
      maxX: via.x,
      minY: via.y,
      maxY: via.y,
    }
    for (const layer of via.layers) {
      const layerIndex = getLayerIndex(layer, input.layerCount)
      viasByLayer[layerIndex]!.push(entry)
    }
    return entry
  })
  return { segmentsByLayer, viasByLayer, vias }
}
