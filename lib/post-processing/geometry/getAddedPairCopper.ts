import type { ParsedTrace } from "../model/internal-types"

const COPPER_COORDINATE_TOLERANCE_MM = 1e-7

/** Return only copper that length matching added or moved from the original pair. */
export const getAddedPairCopper = (input: {
  candidatePair: readonly [ParsedTrace, ParsedTrace]
  originalPair: readonly [ParsedTrace, ParsedTrace]
}): readonly [ParsedTrace, ParsedTrace] => {
  const addedPair = input.candidatePair.map((candidate, pairIndex) => {
    const original = input.originalPair[pairIndex]!
    return {
      ...candidate,
      segments: candidate.segments.filter(
        (segment) =>
          !original.segments.some(
            (originalSegment) =>
              originalSegment.layer === segment.layer &&
              Math.abs(originalSegment.width - segment.width) <=
                COPPER_COORDINATE_TOLERANCE_MM &&
              Math.abs(originalSegment.start.x - segment.start.x) <=
                COPPER_COORDINATE_TOLERANCE_MM &&
              Math.abs(originalSegment.start.y - segment.start.y) <=
                COPPER_COORDINATE_TOLERANCE_MM &&
              Math.abs(originalSegment.end.x - segment.end.x) <=
                COPPER_COORDINATE_TOLERANCE_MM &&
              Math.abs(originalSegment.end.y - segment.end.y) <=
                COPPER_COORDINATE_TOLERANCE_MM,
          ),
      ),
      vias: candidate.vias.filter(
        (via) =>
          !original.vias.some(
            (originalVia) =>
              Math.abs(originalVia.x - via.x) <=
                COPPER_COORDINATE_TOLERANCE_MM &&
              Math.abs(originalVia.y - via.y) <=
                COPPER_COORDINATE_TOLERANCE_MM &&
              Math.abs(originalVia.diameter - via.diameter) <=
                COPPER_COORDINATE_TOLERANCE_MM &&
              originalVia.layers.length === via.layers.length &&
              originalVia.layers.every((layer) => via.layers.includes(layer)),
          ),
      ),
    }
  })
  return [addedPair[0]!, addedPair[1]!]
}
