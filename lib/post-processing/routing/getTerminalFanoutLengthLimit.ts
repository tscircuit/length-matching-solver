import type { SimplifiedPcbTrace } from "../../types"
import type { ParsedTrace, PathPoint } from "../model/internal-types"

type TerminalFanoutLengthInput = {
  lanes: [ParsedTrace, ParsedTrace]
  stations: [PathPoint, PathPoint][]
  immutableTraces: SimplifiedPcbTrace[]
  inlineSpan?: number
  requestedLimit?: number
}

/** Bound directional fanout at a joint so each section leaves toward its own span. */
export function getTerminalFanoutLengthLimit({
  lanes,
  stations,
  immutableTraces,
  inlineSpan,
  requestedLimit,
}: TerminalFanoutLengthInput): number | undefined {
  if (requestedLimit !== undefined || inlineSpan === undefined) {
    return requestedLimit
  }

  const hasInlineJoint = stations.some((station) =>
    station.every((terminal, lane) => {
      const root = lanes[lane]!.source.__postProcessingRootConnectionName
      if (root === undefined) return false
      return immutableTraces.some((other) => {
        if (other.__postProcessingRootConnectionName !== root) return false
        return [other.route[0], other.route.at(-1)].some(
          (endpoint) =>
            endpoint?.route_type === "wire" &&
            endpoint.layer === terminal.layer &&
            Math.hypot(endpoint.x - terminal.x, endpoint.y - terminal.y) <=
              1e-8,
        )
      })
    }),
  )
  return hasInlineJoint ? inlineSpan : undefined
}
