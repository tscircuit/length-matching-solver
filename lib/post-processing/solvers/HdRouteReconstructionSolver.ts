import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { LengthMatchingSolverOutput } from "../../length-matching/types"
import type { SimplifiedPcbTraces } from "../../types"
import type { LengthMatchingBinding } from "../binding/createLengthMatchingBinding"
import { reconstructHdRoutesFromMatchingOutput } from "../binding/reconstructHdRoutesFromMatchingOutput"
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
    this.output = reconstructHdRoutesFromMatchingOutput({
      ...this.input,
      rejectInsideJumperPad: true,
    })
    this.stats = {
      phase: "complete",
      routeCount: this.output.hdRoutes.length,
    }
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
