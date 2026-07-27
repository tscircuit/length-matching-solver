import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { LengthMatchingSolverOutput } from "../../length-matching/types"
import type { LengthMatchingBinding } from "../binding/createLengthMatchingBinding"
import { reconstructSimplifiedPcbTraces } from "../binding/reconstructSimplifiedPcbTraces"
import type { PostProcessingSolverOutput, PostProcessingSolverParams } from "../types"
import { createPostProcessingVisualization } from "../visualization/createPostProcessingVisualization"
import type { FortyFiveDegreeSimplificationOutput } from "./FortyFiveDegreeSimplificationSolver"

export type SimplifiedTraceReconstructionInput = {
  binding: LengthMatchingBinding
  result: LengthMatchingSolverOutput
  simplified: FortyFiveDegreeSimplificationOutput
  params: PostProcessingSolverParams
}

/** Reconstructs and validates the final simplified-trace output. */
export class SimplifiedTraceReconstructionSolver extends BaseSolver {
  private output: PostProcessingSolverOutput | null = null

  constructor(private readonly input: SimplifiedTraceReconstructionInput) {
    super()
  }

  override getSolverName(): string {
    return "SimplifiedTraceReconstructionSolver"
  }

  override _step(): void {
    this.output = {
      traces: reconstructSimplifiedPcbTraces(this.input),
      errors: this.input.simplified.errors.map(
        (error) => new Error(error.message),
      ),
    }
    this.stats = {
      phase: "complete",
      traceCount: this.output.traces.length,
      retainedPairCount: this.output.errors.length,
    }
    this.solved = true
  }

  override getConstructorParams(): [SimplifiedTraceReconstructionInput] {
    return [this.input]
  }

  override getOutput(): PostProcessingSolverOutput {
    if (!this.output || !this.solved)
      throw new Error(
        "SimplifiedTraceReconstructionSolver: getOutput() called before completion",
      )
    return {
      traces: structuredClone(this.output.traces),
      errors: this.output.errors.map((error) => new Error(error.message)),
    }
  }

  override visualize(): GraphicsObject {
    return createPostProcessingVisualization({
      traces: this.output?.traces ?? this.input.simplified.traces,
      obstacles: this.input.params.obstacles,
      bounds: this.input.params.bounds,
      layerCount: this.input.params.layerCount,
      activeConnectionNames: null,
      previewPath: null,
    })
  }
}
