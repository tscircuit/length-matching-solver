import type { ParsedTrace } from "../model/internal-types"
import { sameCopperSegment } from "./sameCopperSegment"
import { sameCopperVia } from "./sameCopperVia"

/** Return only copper that length matching added or moved from the original pair. */
export const getAddedPairCopper = (input: {
  candidatePair: readonly [ParsedTrace, ParsedTrace]
  originalPair: readonly [ParsedTrace, ParsedTrace]
}): readonly [ParsedTrace, ParsedTrace] => {
  const addedPair = input.candidatePair.map((candidate, pairIndex) => {
    const original = input.originalPair[pairIndex]!
    return {
      ...candidate,
      segments: candidate.segments.filter((segment) => {
        const existedBefore = original.segments.some((originalSegment) =>
          sameCopperSegment(originalSegment, segment),
        )
        return !existedBefore
      }),
      vias: candidate.vias.filter((via) => {
        const existedBefore = original.vias.some((originalVia) =>
          sameCopperVia(originalVia, via),
        )
        return !existedBefore
      }),
    }
  })
  return [addedPair[0]!, addedPair[1]!]
}
