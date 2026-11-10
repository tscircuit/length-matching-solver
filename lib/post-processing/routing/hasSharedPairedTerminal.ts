import type { SimplifiedPcbTrace } from "../../types"
import type { ParsedTrace, PathPoint } from "../model/internal-types"

/** An inline joint has an adjoining section on each polarity at the same station. */
export function hasSharedPairedTerminal(
  lanes: [ParsedTrace, ParsedTrace],
  stations: [PathPoint, PathPoint][],
  immutableTraces: SimplifiedPcbTrace[],
): boolean {
  return stations.some((station) =>
    station.every((terminal, lane) => {
      const root = lanes[lane]!.source.__postProcessingRootConnectionName
      if (root === undefined) return false
      return immutableTraces.some((other) => {
        if (other.__postProcessingRootConnectionName !== root) return false
        return [other.route[0], other.route.at(-1)].some(
          (endpoint) =>
            endpoint?.route_type === "wire" &&
            endpoint.layer === terminal.layer &&
            Math.hypot(endpoint.x - terminal.x, endpoint.y - terminal.y) <= 1e-8,
        )
      })
    }),
  )
}
