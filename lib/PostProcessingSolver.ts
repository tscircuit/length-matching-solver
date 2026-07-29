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
  CompleteSimpleRouteJson,
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
  SimpleRouteJson,
} from "./post-processing/types"
import { validatePostProcessingParams } from "./post-processing/validation/validatePostProcessingParams"
import { createPostProcessingVisualization } from "./post-processing/visualization/createPostProcessingVisualization"

/** Runs coupled rerouting, 45-degree smoothing, and regular length matching. */
export class PostProcessingSolver<
  TSimpleRouteJson extends SimpleRouteJson = SimpleRouteJson,
> extends BasePipelineSolver<PostProcessingSolverParams<TSimpleRouteJson>> {
  differentialPairReroutingSolver?: DifferentialPairReroutingSolver
  fortyFiveDegreeSimplificationSolver?: FortyFiveDegreeSimplificationSolver
  lengthMatchingSolver?: LengthMatchingSolver
  simplifiedTraceReconstructionSolver?: SimplifiedTraceReconstructionSolver<TSimpleRouteJson>
  private lengthMatchingBinding: LengthMatchingBinding | null = null
  private completeParams!: PostProcessingSolverParams<
    CompleteSimpleRouteJson<TSimpleRouteJson>
  >

  override pipelineDef: PipelineStep<BaseSolver>[] = [
    definePipelineStep(
      "differentialPairReroutingSolver",
      DifferentialPairReroutingSolver,
      (pipeline: PostProcessingSolver<TSimpleRouteJson>) => [
        pipeline.completeParams,
      ],
    ),
    definePipelineStep(
      "fortyFiveDegreeSimplificationSolver",
      FortyFiveDegreeSimplificationSolver,
      (pipeline: PostProcessingSolver<TSimpleRouteJson>) => {
        const rerouted =
          pipeline.getStageOutput<DifferentialPairReroutingOutput>(
            "differentialPairReroutingSolver",
          )
        if (!rerouted)
          throw new Error(
            "PostProcessingSolver: rerouting stage completed without output",
          )
        const { obstacles, bounds, layerCount } =
          pipeline.completeParams.simpleRouteJson
        return [{ ...rerouted, obstacles, bounds, layerCount }]
      },
    ),
    definePipelineStep(
      "lengthMatchingSolver",
      LengthMatchingSolver,
      (pipeline: PostProcessingSolver<TSimpleRouteJson>) => {
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
          params: pipeline.completeParams,
        })
        return [pipeline.lengthMatchingBinding.solverParams]
      },
    ),
    definePipelineStep(
      "simplifiedTraceReconstructionSolver",
      SimplifiedTraceReconstructionSolver,
      (pipeline: PostProcessingSolver<TSimpleRouteJson>) => {
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
            params: pipeline.completeParams,
          },
        ]
      },
      {
        onSolved: (pipeline: PostProcessingSolver<TSimpleRouteJson>) => {
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
          }
        },
      },
    ),
  ]

  constructor(params: PostProcessingSolverParams<TSimpleRouteJson>) {
    super(params)
    validatePostProcessingParams(params)
    this.completeParams = params
    const reroutingIterationLimit =
      getDifferentialPairReroutingIterationLimit(params)
    const simplificationIterationLimit = Math.max(
      1,
      params.simpleRouteJson.differentialPairs.length + 1,
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

  override getConstructorParams(): [
    PostProcessingSolverParams<TSimpleRouteJson>,
  ] {
    return [this.inputProblem]
  }

  override getOutput(): PostProcessingSolverOutput<TSimpleRouteJson> {
    if (!this.solved)
      throw new Error(
        "PostProcessingSolver: getOutput() called before the solver completed",
      )
    const output = this.getStageOutput<
      PostProcessingSolverOutput<TSimpleRouteJson>
    >("simplifiedTraceReconstructionSolver")
    if (!output)
      throw new Error(
        "PostProcessingSolver: completed pipeline is missing reconstruction output",
      )
    return {
      simpleRouteJson: structuredClone(output.simpleRouteJson),
    }
  }

  override initialVisualize(): GraphicsObject {
    const { traces, obstacles, bounds, layerCount } =
      this.completeParams.simpleRouteJson
    return createPostProcessingVisualization({
      traces: structuredClone(traces),
      obstacles,
      bounds,
      layerCount,
      activeConnectionNames: null,
      previewPath: null,
    })
  }

  override finalVisualize(): GraphicsObject {
    const { simpleRouteJson } = this.getOutput()
    return createPostProcessingVisualization({
      traces: simpleRouteJson.traces,
      obstacles: simpleRouteJson.obstacles,
      bounds: simpleRouteJson.bounds,
      layerCount: simpleRouteJson.layerCount,
      activeConnectionNames: null,
      previewPath: null,
    })
  }
}

export {
  DifferentialPairRoutingError,
  type DifferentialPairRoutingFailureReason,
} from "./post-processing/errors/DifferentialPairRoutingError"
export type {
  CompleteSimpleRouteJson,
  PostProcessedSimpleRouteJson,
  PostProcessingGridConfig,
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
  SimpleRouteJson,
} from "./post-processing/types"
