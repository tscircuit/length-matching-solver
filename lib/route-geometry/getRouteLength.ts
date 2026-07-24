import type { HighDensityRoute } from "../types"
import { getSegmentLength } from "./getSegmentLength"

/** Sum the planar lengths of every consecutive segment in a routed connection. */
export const getRouteLength = (route: HighDensityRoute): number => {
  let length = 0
  for (let index = 0; index < route.route.length - 1; index++) {
    length += getSegmentLength(route.route[index]!, route.route[index + 1]!)
  }
  return length
}
