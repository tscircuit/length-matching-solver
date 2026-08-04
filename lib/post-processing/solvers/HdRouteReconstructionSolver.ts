import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { LengthMatchingSolverOutput } from "../../length-matching/types"
import type { RoutePoint, SimplifiedPcbTraces } from "../../types"
import type { LengthMatchingBinding } from "../binding/createLengthMatchingBinding"
import { reconstructSimplifiedPcbTraces } from "../binding/reconstructSimplifiedPcbTraces"
import type {
  InternalPostProcessingParams,
  PostProcessingModel,
  PostProcessingSolverOutput,
} from "../types"
import { createPostProcessingVisualization } from "../visualization/createPostProcessingVisualization"
import type { FortyFiveDegreeSimplificationOutput } from "./FortyFiveDegreeSimplificationSolver"

export type HdRouteReconstructionInput = {
  binding: LengthMatchingBinding
  result: LengthMatchingSolverOutput
  simplified: FortyFiveDegreeSimplificationOutput
  params: InternalPostProcessingParams
  model: PostProcessingModel
}

/** Validates matched copper and restores the native HD-route identities. */
export class HdRouteReconstructionSolver extends BaseSolver {
  private output: PostProcessingSolverOutput | null = null
  private visualizationTraces: SimplifiedPcbTraces | null = null

  constructor(private readonly input: HdRouteReconstructionInput) {
    super()
  }

  override getSolverName(): string {
    return "HdRouteReconstructionSolver"
  }

  override _step(): void {
    this.visualizationTraces = reconstructSimplifiedPcbTraces(this.input)
    const hdRoutes = structuredClone(this.input.model.sourceHdRoutes)
    for (const routeBinding of this.input.model.routeBindings) {
      const lengthBinding = this.input.binding.traceBindings.find(
        (candidate) => candidate.traceIndex === routeBinding.traceIndex,
      )
      if (!lengthBinding)
        throw new Error(
          `PostProcessingSolver: missing native HD binding for "${routeBinding.internalConnectionName}"`,
        )
      const matchedRoute =
        this.input.result.matchedHdRoutes[lengthBinding.matchedRouteIndex]
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
        if (source.insideJumperPad)
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
    this.output = { hdRoutes, nonIdealRouteIssues: [] }
    this.stats = { phase: "complete", routeCount: hdRoutes.length }
    this.solved = true
  }

  override getConstructorParams(): [HdRouteReconstructionInput] {
    return [this.input]
  }

  override getOutput(): PostProcessingSolverOutput {
    if (!this.output || !this.solved)
      throw new Error(
        "HdRouteReconstructionSolver: getOutput() called before completion",
      )
    return structuredClone(this.output)
  }

  override visualize(): GraphicsObject {
    const traces = this.visualizationTraces ?? this.input.simplified.traces
    const { obstacles, bounds, layerCount } = this.input.params.simpleRouteJson
    return createPostProcessingVisualization({
      traces,
      obstacles,
      bounds,
      layerCount,
      activeConnectionNames: null,
      previewPath: null,
    })
  }
}
