import type { DifferentialPair, SimplifiedPcbTraces } from "../../types"
import { getSimplifiedTraceLength } from "../length-matching/getSimplifiedTraceLength"
import { parseSimplifiedPcbTrace } from "../model/parseSimplifiedPcbTrace"

/** Select rerouted pairs and unresolved-skew pairs that have bindable copper. */
export const getLengthMatchingPairs = (input: {
  traces: SimplifiedPcbTraces
  declaredPairs: DifferentialPair[]
  reroutedPairs: DifferentialPair[]
  layerCount: number
}): DifferentialPair[] => {
  const reroutedPairKeys = new Set(
    input.reroutedPairs.map((pair) => pair.connectionNames.join("\u0000")),
  )
  return input.declaredPairs
    .filter((pair) => {
      const matches = pair.connectionNames.map((connectionName) =>
        input.traces.filter(
          (trace) => trace.connection_name === connectionName,
        ),
      )
      if (matches.some((pairMatches) => pairMatches.length !== 1)) return false
      if (reroutedPairKeys.has(pair.connectionNames.join("\u0000"))) return true
      const traces = matches.map((pairMatches) => pairMatches[0]!)
      if (
        traces.some(
          (trace) =>
            trace.route.length < 2 ||
            trace.route[0]?.route_type !== "wire" ||
            !trace.route.every(
              (entry) =>
                entry.route_type === "wire" || entry.route_type === "via",
            ),
        )
      )
        return false
      const lengths = traces.map((trace) =>
        getSimplifiedTraceLength(
          parseSimplifiedPcbTrace(trace, input.layerCount),
        ),
      )
      return Math.abs(lengths[0]! - lengths[1]!) > pair.lengthTolerance + 1e-7
    })
    .map((pair) => structuredClone(pair))
}
