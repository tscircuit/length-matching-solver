import type { LengthMatchingSolverOutput } from "../../length-matching/types"
import type {
  SimplifiedPcbTraceRoutePoint,
  SimplifiedPcbTraceWireRoutePoint,
  SimplifiedPcbTraces,
} from "../../types"
import { getLayerName } from "../geometry/getLayerName"
import { getSimplifiedTraceLength } from "../length-matching/getSimplifiedTraceLength"
import { validateCandidateGeometry } from "../geometry/validateCandidateGeometry"
import { parseSimplifiedPcbTrace } from "../model/parseSimplifiedPcbTrace"
import type { FortyFiveDegreeSimplificationOutput } from "../solvers/FortyFiveDegreeSimplificationSolver"
import type { InternalPostProcessingParams } from "../types"
import { PostProcessingConstraintError } from "../errors/PostProcessingConstraintError"
import type { LengthMatchingBinding } from "./createLengthMatchingBinding"

/** Rebuild simplified traces and validate each complete length-matched pair. */
export const reconstructSimplifiedPcbTraces = (input: {
  binding: LengthMatchingBinding
  result: LengthMatchingSolverOutput
  simplified: FortyFiveDegreeSimplificationOutput
  params: InternalPostProcessingParams
}): SimplifiedPcbTraces => {
  const { simpleRouteJson } = input.params
  if (
    input.result.matchedHdRoutes.length !==
    input.binding.solverParams.hdRoutes.length
  )
    throw new Error(
      "PostProcessingSolver: LengthMatchingSolver changed the search route count",
    )
  const traces = structuredClone(input.binding.baseTraces)

  for (const binding of input.binding.traceBindings) {
    const hdRoute = input.result.matchedHdRoutes[binding.matchedRouteIndex]
    if (!hdRoute)
      throw new Error(
        `PostProcessingSolver: missing matched route at index ${binding.matchedRouteIndex}`,
      )
    const source = traces[binding.traceIndex]
    if (!source)
      throw new Error(
        `PostProcessingSolver: missing simplified trace binding at index ${binding.traceIndex}`,
      )
    if (source.connection_name !== hdRoute.connectionName)
      throw new Error(
        `PostProcessingSolver: route binding changed connection "${source.connection_name}" to "${hdRoute.connectionName}"`,
      )
    if (hdRoute.route.length < 2)
      throw new Error(
        `PostProcessingSolver: matched connection "${hdRoute.connectionName}" has incomplete geometry`,
      )
    const matchedStart = hdRoute.route[0]!
    const matchedEnd = hdRoute.route.at(-1)!
    if (
      Math.hypot(
        matchedStart.x - binding.startEndpoint.x,
        matchedStart.y - binding.startEndpoint.y,
      ) > 1e-8 ||
      matchedStart.z !== binding.startEndpoint.z ||
      Math.hypot(
        matchedEnd.x - binding.endEndpoint.x,
        matchedEnd.y - binding.endEndpoint.y,
      ) > 1e-8 ||
      matchedEnd.z !== binding.endEndpoint.z
    )
      throw new Error(
        `PostProcessingSolver: matched connection "${hdRoute.connectionName}" moved a preserved endpoint`,
      )

    const rebuilt: SimplifiedPcbTraceRoutePoint[] = []
    let viaIndex = 0
    const createWire = (
      point: (typeof hdRoute.route)[number],
    ): SimplifiedPcbTraceWireRoutePoint => ({
      route_type: "wire",
      x: point.x,
      y: point.y,
      width: point.traceThickness ?? hdRoute.traceThickness,
      layer: getLayerName(point.z, simpleRouteJson.layerCount),
    })
    rebuilt.push(createWire(hdRoute.route[0]!))
    for (let pointIndex = 1; pointIndex < hdRoute.route.length; pointIndex++) {
      const previous = hdRoute.route[pointIndex - 1]!
      const point = hdRoute.route[pointIndex]!
      if (previous.z === point.z) {
        rebuilt.push(createWire(point))
        continue
      }
      if (Math.hypot(previous.x - point.x, previous.y - point.y) > 1e-8)
        throw new Error(
          `PostProcessingSolver: matched connection "${hdRoute.connectionName}" moves while changing layers`,
        )
      const template = binding.viaTemplates[viaIndex++]
      if (!template)
        throw new Error(
          `PostProcessingSolver: matched connection "${hdRoute.connectionName}" added an unbound via`,
        )
      if (Math.hypot(template.x - point.x, template.y - point.y) > 1e-8)
        throw new Error(
          `PostProcessingSolver: matched connection "${hdRoute.connectionName}" moved a preserved via`,
        )
      const fromLayer = getLayerName(previous.z, simpleRouteJson.layerCount)
      const toLayer = getLayerName(point.z, simpleRouteJson.layerCount)
      const templateLayers = new Set([template.from_layer, template.to_layer])
      if (!templateLayers.has(fromLayer) || !templateLayers.has(toLayer))
        throw new Error(
          `PostProcessingSolver: matched connection "${hdRoute.connectionName}" changed a preserved via span`,
        )
      rebuilt.push({ ...template })
      rebuilt.push(createWire(point))
    }
    if (viaIndex !== binding.viaTemplates.length)
      throw new Error(
        `PostProcessingSolver: matched connection "${hdRoute.connectionName}" removed a preserved via`,
      )
    const wires = rebuilt.filter(
      (entry): entry is SimplifiedPcbTraceWireRoutePoint =>
        entry.route_type === "wire",
    )
    for (const wire of wires) {
      delete wire.start_pcb_port_id
      delete wire.end_pcb_port_id
    }
    if (binding.startPortId) wires[0]!.start_pcb_port_id = binding.startPortId
    if (binding.endPortId) wires.at(-1)!.end_pcb_port_id = binding.endPortId
    traces[binding.traceIndex] = { ...source, route: rebuilt }
  }

  for (const pair of input.binding.solverParams.differentialPairs) {
    const pairName = pair.connectionNames.join("/")
    const matches = pair.connectionNames.map((connectionName) =>
      traces
        .map((trace, index) => ({ trace, index }))
        .filter(({ trace }) => trace.connection_name === connectionName),
    )
    if (matches[0]!.length !== 1 || matches[1]!.length !== 1)
      throw new Error(
        `PostProcessingSolver: reconstructed pair ${pairName} does not resolve to complete copper`,
      )
    const firstMatch = matches[0]![0]!
    const secondMatch = matches[1]![0]!
    const first = parseSimplifiedPcbTrace(
      firstMatch.trace,
      simpleRouteJson.layerCount,
    )
    const second = parseSimplifiedPcbTrace(
      secondMatch.trace,
      simpleRouteJson.layerCount,
    )
    const finalLengthDifference = Math.abs(
      getSimplifiedTraceLength(first) - getSimplifiedTraceLength(second),
    )
    if (finalLengthDifference > pair.lengthTolerance + 1e-7)
      throw new PostProcessingConstraintError({
        message: `PostProcessingSolver: reconstructed pair ${pairName} exceeds length tolerance ${pair.lengthTolerance} with error ${finalLengthDifference}`,
        connectionNames: [...pair.connectionNames],
        reason: "length-tolerance-unsatisfied",
      })
    const valid = validateCandidateGeometry(first, second, {
      immutableTraces: traces.filter(
        (_, index) => index !== firstMatch.index && index !== secondMatch.index,
      ),
      obstacles: simpleRouteJson.obstacles,
      bounds: simpleRouteJson.bounds,
      layerCount: simpleRouteJson.layerCount,
    })
    if (!valid)
      throw new PostProcessingConstraintError({
        message: `PostProcessingSolver: length matching produced invalid complete copper for pair ${pairName}`,
        connectionNames: [...pair.connectionNames],
        reason: "invalid-final-copper",
      })
  }
  return traces
}
