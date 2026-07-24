import { getSegmentLength } from "../../route-geometry"
import type { HighDensityRoute } from "../../types"
import type { MeanderPlacement, SegmentCandidate } from "../internal-types"

const DEFAULT_MIN_MEANDER_GAP = 0.3

/** Enumerate deterministic segment, tooth-count, and side choices for tuning. */
export const createMeanderCandidates = (input: {
  routes: HighDensityRoute[]
  routeIndexes: number[]
  maximumDepth: number
  minimumToothPitch?: number
  minMeanderGap?: number
  minMeanderHeight?: number
  maxToothCount: number
}): SegmentCandidate[] => {
  const candidates: SegmentCandidate[] = []
  for (const routeIndex of input.routeIndexes) {
    const route = input.routes[routeIndex]!
    const minMeanderGap =
      input.minMeanderGap ??
      Math.max(DEFAULT_MIN_MEANDER_GAP, route.traceThickness * 2)
    const minimumTraceCenterlineSpacing = route.traceThickness + minMeanderGap
    const toothPitch = Math.max(
      input.minimumToothPitch ?? 0,
      minimumTraceCenterlineSpacing * 2,
    )
    const minimumHeight =
      input.minMeanderHeight ?? minimumTraceCenterlineSpacing
    for (
      let segmentIndex = 0;
      segmentIndex < route.route.length - 1;
      segmentIndex++
    ) {
      const start = route.route[segmentIndex]!
      const end = route.route[segmentIndex + 1]!
      const segmentLength = getSegmentLength(start, end)
      if (segmentLength <= 0 || start.z !== end.z) continue
      const toothCapacity = Math.min(
        Math.max(0, Math.floor(segmentLength / toothPitch) - 1),
        input.maxToothCount,
      )
      for (let toothCount = 1; toothCount <= toothCapacity; toothCount++) {
        // Explore the open segment as well as the minimum-clearance footprint.
        // The geometric mean supplies one deterministic constrained compromise.
        const maximumRelaxedPitch = segmentLength / (toothCount + 1)
        const pitchOptions = [
          maximumRelaxedPitch,
          Math.sqrt(toothPitch * maximumRelaxedPitch),
          toothPitch,
        ].filter(
          (pitch, pitchIndex, pitches) =>
            pitches.findIndex(
              (otherPitch) => Math.abs(otherPitch - pitch) < 1e-9,
            ) === pitchIndex,
        )
        const placements: MeanderPlacement[] =
          toothCount % 2 === 0
            ? ["balanced", "negative", "positive"]
            : ["negative", "positive"]
        for (const candidatePitch of pitchOptions)
          for (const placement of placements)
            candidates.push({
              routeIndex,
              segmentIndex,
              segmentLength,
              toothCount,
              maximumDepth: input.maximumDepth,
              minimumHeight,
              toothPitch: candidatePitch,
              placement,
              heightProfile: toothCount > 1 ? "tapered" : "uniform",
            })
      }
    }
  }
  const placementPriority: Record<MeanderPlacement, number> = {
    balanced: 0,
    negative: 1,
    positive: 2,
  }
  return candidates.sort(
    (left, right) =>
      left.toothCount - right.toothCount ||
      placementPriority[left.placement] - placementPriority[right.placement] ||
      right.toothPitch - left.toothPitch ||
      right.segmentLength - left.segmentLength,
  )
}
