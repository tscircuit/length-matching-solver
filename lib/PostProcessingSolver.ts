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
import { createPostProcessingModel } from "./post-processing/binding/createPostProcessingModel"
import { getDifferentialPairReroutingIterationLimit } from "./post-processing/routing/getDifferentialPairReroutingIterationLimit"
import {
  DifferentialPairReroutingSolver,
  type DifferentialPairReroutingOutput,
} from "./post-processing/solvers/DifferentialPairReroutingSolver"
import {
  FortyFiveDegreeSimplificationSolver,
  type FortyFiveDegreeSimplificationOutput,
} from "./post-processing/solvers/FortyFiveDegreeSimplificationSolver"
import { HdRoutePassthroughSolver } from "./post-processing/solvers/HdRoutePassthroughSolver"
import { HdRouteReconstructionSolver } from "./post-processing/solvers/HdRouteReconstructionSolver"
import type {
  NonIdealPostProcessingIssue,
  PostProcessingModel,
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
  hdRouteReconstructionSolver?: HdRouteReconstructionSolver
  hdRoutePassthroughSolver?: HdRoutePassthroughSolver
  private lengthMatchingBinding: LengthMatchingBinding | null = null
  private readonly model!: PostProcessingModel
  private readonly isPassthrough: boolean
  private fallbackOutput: PostProcessingSolverOutput | null = null
  private readonly nonIdealRouteIssues: NonIdealPostProcessingIssue[] = []

  override pipelineDef: PipelineStep<BaseSolver>[] = [
    definePipelineStep(
      "differentialPairReroutingSolver",
      DifferentialPairReroutingSolver,
      (pipeline: PostProcessingSolver) => [pipeline.model.params],
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
        const { obstacles, bounds, layerCount, allowViaInPad } =
          pipeline.model.params.simpleRouteJson
        return [{ ...rerouted, obstacles, bounds, layerCount, allowViaInPad }]
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
          params: pipeline.model.params,
        })
        return [pipeline.lengthMatchingBinding.solverParams]
      },
    ),
    definePipelineStep(
      "hdRouteReconstructionSolver",
      HdRouteReconstructionSolver,
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
            params: pipeline.model.params,
            model: pipeline.model,
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
          }
        },
      },
    ),
  ]

  constructor(params: PostProcessingSolverParams) {
    super(structuredClone(params))
    this.isPassthrough =
      Array.isArray(params.differentialPairs) &&
      params.differentialPairs.length === 0
    try {
      if (this.isPassthrough) {
        validatePostProcessingParams(params, {
          validateHdRouteGeometry: false,
        })
        this.pipelineDef = [
          definePipelineStep(
            "hdRoutePassthroughSolver",
            HdRoutePassthroughSolver,
            (pipeline: PostProcessingSolver) => [
              { hdRoutes: pipeline.inputProblem.hdRoutes },
            ],
            {
              onSolved: (pipeline: PostProcessingSolver) => {
                pipeline.stats = {
                  phase: "complete",
                  acceptedPairCount: 0,
                }
              },
            },
          ),
        ]
        this.MAX_ITERATIONS = 3
        return
      }
      validatePostProcessingParams(params, {
        validateHdRouteGeometry: true,
      })
      this.model = createPostProcessingModel(params)
      const reroutingIterationLimit =
        getDifferentialPairReroutingIterationLimit(this.model.params)
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
    } catch (error) {
      this.finishWithNonIdealOutput(error, "validation")
    }
  }

  override getSolverName(): string {
    return "PostProcessingSolver"
  }

  override getConstructorParams(): [PostProcessingSolverParams] {
    return [structuredClone(this.inputProblem)]
  }

  override _step(): void {
    try {
      super._step()
    } catch (error) {
      this.finishWithNonIdealOutput(error, this.getCurrentStageName())
      return
    }
    if (this.failed)
      this.finishWithNonIdealOutput(
        this.error ?? "PostProcessingSolver failed without an error message",
        this.getCurrentStageName(),
      )
  }

  private finishWithNonIdealOutput(error: unknown, stage: string): void {
    const message = error instanceof Error ? error.message : String(error)
    const connectionName = message.match(/(?:HD route|connection) "([^"]+)"/)?.[1]
    this.nonIdealRouteIssues.push({
      type: "post_processing_error",
      stage,
      message,
      ...(connectionName ? { connectionName } : {}),
      returnedRouteSource: "input-hd-routes",
    })
    this.fallbackOutput = {
      hdRoutes: structuredClone(this.inputProblem.hdRoutes),
      nonIdealRouteIssues: [],
    }
    this.activeSubSolver = null
    this.error = null
    this.failed = false
    this.solved = true
    this.progress = 1
    this.stats = { phase: "complete", nonIdealRouteIssueCount: 1 }
  }

  override getOutput(): PostProcessingSolverOutput {
    if (!this.solved)
      throw new Error(
        "PostProcessingSolver: getOutput() called before the solver completed",
      )
    const output =
      this.fallbackOutput ??
      this.getStageOutput<PostProcessingSolverOutput>(
        this.isPassthrough
          ? "hdRoutePassthroughSolver"
          : "hdRouteReconstructionSolver",
      )
    if (!output)
      throw new Error(
        "PostProcessingSolver: completed pipeline is missing reconstruction output",
      )
    return {
      ...structuredClone(output),
      nonIdealRouteIssues: structuredClone(this.nonIdealRouteIssues),
    }
  }

  override initialVisualize(): GraphicsObject {
    if (this.fallbackOutput)
      return {
        lines: this.fallbackOutput.hdRoutes.map((route) => ({
          points: route.route.map(({ x, y }) => ({ x, y })),
          strokeWidth: route.traceThickness,
        })),
      }
    const model = this.isPassthrough
      ? createPostProcessingModel(this.inputProblem)
      : this.model
    const { traces, obstacles, bounds, layerCount } =
      model.params.simpleRouteJson
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
    if (this.fallbackOutput) return this.initialVisualize()
    const outputModel = createPostProcessingModel({
      ...this.inputProblem,
      hdRoutes: this.getOutput().hdRoutes,
    })
    const { traces, obstacles, bounds, layerCount } =
      outputModel.params.simpleRouteJson
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

export {
  DifferentialPairRoutingError,
  type DifferentialPairRoutingFailureReason,
} from "./post-processing/errors/DifferentialPairRoutingError"
export type {
  NonIdealPostProcessingIssue,
  PostProcessingGridConfig,
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "./post-processing/types"
