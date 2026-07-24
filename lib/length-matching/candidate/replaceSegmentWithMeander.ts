import type { RoutePoint } from "../../types"
import {
  createMeanderReplacement,
  type MeanderGeometryInput,
} from "./createMeanderReplacement"

/** Construct a variable-height meander with tangentially rounded turns. */
export const replaceSegmentWithMeander = (
  input: MeanderGeometryInput,
): RoutePoint[] => [
  ...input.route.route.slice(0, input.segmentIndex),
  ...createMeanderReplacement(input),
  ...input.route.route.slice(input.segmentIndex + 2),
]
