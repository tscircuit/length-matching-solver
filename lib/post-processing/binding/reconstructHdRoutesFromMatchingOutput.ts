import type { LengthMatchingSolverOutput } from "../../length-matching/types"
import type { RoutePoint } from "../../types"
import type { PostProcessingModel, PostProcessingSolverOutput } from "../types"
import type { LengthMatchingBinding } from "./createLengthMatchingBinding"

/** Restores native HD-route identities without requiring ideal final geometry. */
export function reconstructHdRoutesFromMatchingOutput(input: {
  binding: LengthMatchingBinding
  result: LengthMatchingSolverOutput
  model: PostProcessingModel
  rejectInsideJumperPad?: boolean
}): PostProcessingSolverOutput {
  const hdRoutes = structuredClone(input.model.sourceHdRoutes)
  for (const routeBinding of input.model.routeBindings) {
    const lengthBinding = input.binding.traceBindings.find(
      (candidate) => candidate.traceIndex === routeBinding.traceIndex,
    )
    if (!lengthBinding) continue
    const matchedRoute =
      input.result.matchedHdRoutes[lengthBinding.matchedRouteIndex]
    const sourceRoute = hdRoutes[routeBinding.hdRouteIndex]
    if (!matchedRoute || !sourceRoute)
      throw new Error(
        `PostProcessingSolver: missing matched or source HD route for "${routeBinding.internalConnectionName}"`,
      )
    if (matchedRoute.connectionName !== routeBinding.internalConnectionName)
      throw new Error(
        `PostProcessingSolver: matched HD binding changed "${routeBinding.internalConnectionName}" to "${matchedRoute.connectionName}"`,
      )
    const route = matchedRoute.route.map((point) => ({ ...point }))
    const copyEndpointMetadata = (
      target: RoutePoint | undefined,
      source: RoutePoint | undefined,
    ): void => {
      if (!target || !source) return
      if (source.pcb_port_id) target.pcb_port_id = source.pcb_port_id
      if (source.insideJumperPad && input.rejectInsideJumperPad)
        throw new Error(
          `PostProcessingSolver: cannot restore jumper-pad metadata on rerouted connection "${routeBinding.internalConnectionName}"`,
        )
    }
    copyEndpointMetadata(route[0], sourceRoute.route[0])
    copyEndpointMetadata(route.at(-1), sourceRoute.route.at(-1))
    hdRoutes[routeBinding.hdRouteIndex] = {
      ...sourceRoute,
      route,
      vias: matchedRoute.vias.map((via) => ({
        ...via,
        ...(via.zLayers ? { zLayers: [...via.zLayers] } : {}),
      })),
    }
  }
  return { hdRoutes }
}
