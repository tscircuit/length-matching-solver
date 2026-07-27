import {
  BasePipelineSolver,
  definePipelineStep,
  type BaseSolver,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { LengthMatchingSolver } from "./length-matching-solver"
import {
  createLengthMatchingBinding,
  type LengthMatchingBinding,
} from "./post-processing/binding/createLengthMatchingBinding"
import { cloneSimplifiedPcbTraces } from "./post-processing/model/cloneSimplifiedPcbTraces"
import { getDifferentialPairReroutingIterationLimit } from "./post-processing/routing/getDifferentialPairReroutingIterationLimit"
import {
  DifferentialPairReroutingSolver,
  type DifferentialPairReroutingOutput,
} from "./post-processing/solvers/DifferentialPairReroutingSolver"
import {
  FortyFiveDegreeSimplificationSolver,
  type FortyFiveDegreeSimplificationOutput,
} from "./post-processing/solvers/FortyFiveDegreeSimplificationSolver"
import { SimplifiedTraceReconstructionSolver } from "./post-processing/solvers/SimplifiedTraceReconstructionSolver"
import type {
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "./post-processing/types"
import { validatePostProcessingParams } from "./post-processing/validation/validatePostProcessingParams"
import { createPostProcessingVisualization } from "./post-processing/visualization/createPostProcessingVisualization"

/** Runs coupled rerouting, 45-degree smoothing, and regular length matching. */
export class PostProcessingSolver extends BasePipelineSolver<PostProcessingSolverParams> {
  differentialPairReroutingSolver?: DifferentialPairReroutingSolver
  fortyFiveDegreeSimplificationSolver?: FortyFiveDegreeSimplificationSolver
  lengthMatchingSolver?: LengthMatchingSolver
  simplifiedTraceReconstructionSolver?: SimplifiedTraceReconstructionSolver
  private lengthMatchingBinding: LengthMatchingBinding | null = null

  override pipelineDef: PipelineStep<BaseSolver>[] = [
    definePipelineStep(
      "differentialPairReroutingSolver",
      DifferentialPairReroutingSolver,
      (pipeline: PostProcessingSolver) => [pipeline.inputProblem],
    ),
    definePipelineStep(
      "fortyFiveDegreeSimplificationSolver",
      FortyFiveDegreeSimplificationSolver,
      (pipeline: PostProcessingSolver) => {
        const rerouted =
          pipeline.getStageOutput<DifferentialPairReroutingOutput>(
            "differentialPairReroutingSolver",
          )
        if (!rerouted)
          throw new Error(
            "PostProcessingSolver: rerouting stage completed without output",
          )
        return [
          {
            ...rerouted,
            obstacles: pipeline.inputProblem.obstacles,
            bounds: pipeline.inputProblem.bounds,
            layerCount: pipeline.inputProblem.layerCount,
          },
        ]
      },
    ),
    definePipelineStep(
      "lengthMatchingSolver",
      LengthMatchingSolver,
      (pipeline: PostProcessingSolver) => {
        const simplified =
          pipeline.getStageOutput<FortyFiveDegreeSimplificationOutput>(
            "fortyFiveDegreeSimplificationSolver",
          )
        if (!simplified)
          throw new Error(
            "PostProcessingSolver: 45-degree simplification stage completed without output",
          )
        pipeline.lengthMatchingBinding = createLengthMatchingBinding({
          result: simplified,
          params: pipeline.inputProblem,
        })
        return [pipeline.lengthMatchingBinding.solverParams]
      },
    ),
    definePipelineStep(
      "simplifiedTraceReconstructionSolver",
      SimplifiedTraceReconstructionSolver,
      (pipeline: PostProcessingSolver) => {
        const simplified =
          pipeline.getStageOutput<FortyFiveDegreeSimplificationOutput>(
            "fortyFiveDegreeSimplificationSolver",
          )
        const matched = pipeline.getStageOutput<
          ReturnType<LengthMatchingSolver["getOutput"]>
        >("lengthMatchingSolver")
        if (!simplified || !matched || !pipeline.lengthMatchingBinding)
          throw new Error(
            "PostProcessingSolver: reconstruction stage is missing a required binding or output",
          )
        return [
          {
            binding: pipeline.lengthMatchingBinding,
            result: matched,
            simplified,
            params: pipeline.inputProblem,
          },
        ]
      },
      {
        onSolved: (pipeline: PostProcessingSolver) => {
          const rerouted =
            pipeline.getStageOutput<DifferentialPairReroutingOutput>(
              "differentialPairReroutingSolver",
            )
          if (!rerouted)
            throw new Error(
              "PostProcessingSolver: cannot summarize missing rerouting output",
            )
          pipeline.stats = {
            phase: "complete",
            acceptedPairCount: rerouted.reroutedPairs.length,
            retainedPairCount: rerouted.errors.length,
          }
        },
      },
    ),
  ]

  constructor(params: PostProcessingSolverParams) {
    super(params)
    validatePostProcessingParams(params)
    const reroutingIterationLimit =
      getDifferentialPairReroutingIterationLimit(params)
    const simplificationIterationLimit = Math.max(
      1,
      params.differentialPairs.length + 1,
    )
    const lengthMatchingIterationLimit = 100_000
    const pipelineLifecycleIterations = 10
    const pipelineIterationLimit =
      reroutingIterationLimit +
      simplificationIterationLimit +
      lengthMatchingIterationLimit +
      pipelineLifecycleIterations
    if (!Number.isSafeInteger(pipelineIterationLimit))
      throw new Error(
        "PostProcessingSolver: derived pipeline iteration bound exceeds the safe integer range",
      )
    this.MAX_ITERATIONS = pipelineIterationLimit
  }

  override getSolverName(): string {
    return "PostProcessingSolver"
  }

  override getConstructorParams(): [PostProcessingSolverParams] {
    return [this.inputProblem]
  }

  override getOutput(): PostProcessingSolverOutput {
    if (!this.solved)
      throw new Error(
        "PostProcessingSolver: getOutput() called before the solver completed",
      )
    const output = this.getStageOutput<PostProcessingSolverOutput>(
      "simplifiedTraceReconstructionSolver",
    )
    if (!output)
      throw new Error(
        "PostProcessingSolver: completed pipeline is missing reconstruction output",
      )
    return {
      traces: cloneSimplifiedPcbTraces(output.traces),
      errors: output.errors.map((error) => new Error(error.message)),
    }
  }

  override initialVisualize(): GraphicsObject {
    return createPostProcessingVisualization({
      traces: cloneSimplifiedPcbTraces(this.inputProblem.traces),
      obstacles: this.inputProblem.obstacles,
      bounds: this.inputProblem.bounds,
      layerCount: this.inputProblem.layerCount,
      activeConnectionNames: null,
      previewPath: null,
    })
  }

  override finalVisualize(): GraphicsObject {
    return createPostProcessingVisualization({
      traces: this.getOutput().traces,
      obstacles: this.inputProblem.obstacles,
      bounds: this.inputProblem.bounds,
      layerCount: this.inputProblem.layerCount,
      activeConnectionNames: null,
      previewPath: null,
    })
  }
}

export type {
  PostProcessingGridConfig,
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "./post-processing/types"
