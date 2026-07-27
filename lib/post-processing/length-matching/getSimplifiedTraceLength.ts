import type { ParsedTrace } from "../model/internal-types"

/** Measure planar wire centerline length; stackup data is unavailable for vias. */
export const getSimplifiedTraceLength = (trace: ParsedTrace): number =>
  trace.segments.reduce(
    (total, segment) =>
      total +
      Math.hypot(
        segment.end.x - segment.start.x,
        segment.end.y - segment.start.y,
      ),
    0,
  )
