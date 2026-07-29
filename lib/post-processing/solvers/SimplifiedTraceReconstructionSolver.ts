import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { LengthMatchingSolverOutput } from "../../length-matching/types"
import type { LengthMatchingBinding } from "../binding/createLengthMatchingBinding"
import { reconstructSimplifiedPcbTraces } from "../binding/reconstructSimplifiedPcbTraces"
import type {
  CompleteSimpleRouteJson,
  PostProcessedSimpleRouteJson,
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
  SimpleRouteJson,
} from "../types"
import { createPostProcessingVisualization } from "../visualization/createPostProcessingVisualization"
import type { FortyFiveDegreeSimplificationOutput } from "./FortyFiveDegreeSimplificationSolver"

export type SimplifiedTraceReconstructionInput<
  TSimpleRouteJson extends SimpleRouteJson = SimpleRouteJson,
> = {
  binding: LengthMatchingBinding
  result: LengthMatchingSolverOutput
  simplified: FortyFiveDegreeSimplificationOutput
  params: PostProcessingSolverParams<
    CompleteSimpleRouteJson<TSimpleRouteJson>
  >
}

/** Reconstructs and validates the final simplified-trace output. */
export class SimplifiedTraceReconstructionSolver<
  TSimpleRouteJson extends SimpleRouteJson = SimpleRouteJson,
> extends BaseSolver {
  private output: PostProcessingSolverOutput<TSimpleRouteJson> | null = null

  constructor(
    private readonly input: SimplifiedTraceReconstructionInput<TSimpleRouteJson>,
  ) {
    super()
  }

  override getSolverName(): string {
    return "SimplifiedTraceReconstructionSolver"
  }

  override _step(): void {
    const simpleRouteJson = {
      ...structuredClone(this.input.params.simpleRouteJson),
      traces: reconstructSimplifiedPcbTraces(this.input),
    } as PostProcessedSimpleRouteJson<TSimpleRouteJson>
    this.output = { simpleRouteJson }
    this.stats = {
      phase: "complete",
      traceCount: this.output.simpleRouteJson.traces.length,
    }
    this.solved = true
  }

  override getConstructorParams(): [
    SimplifiedTraceReconstructionInput<TSimpleRouteJson>,
  ] {
    return [this.input]
  }

  override getOutput(): PostProcessingSolverOutput<TSimpleRouteJson> {
    if (!this.output || !this.solved)
      throw new Error(
        "SimplifiedTraceReconstructionSolver: getOutput() called before completion",
      )
    return {
      simpleRouteJson: structuredClone(this.output.simpleRouteJson),
    }
  }

  override visualize(): GraphicsObject {
    const { obstacles, bounds, layerCount } =
      this.input.params.simpleRouteJson
    return createPostProcessingVisualization({
      traces:
        this.output?.simpleRouteJson.traces ?? this.input.simplified.traces,
      obstacles,
      bounds,
      layerCount,
      activeConnectionNames: null,
      previewPath: null,
    })
  }
}
