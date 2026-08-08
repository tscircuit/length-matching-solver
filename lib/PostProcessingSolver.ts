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
import { reconstructHdRoutesFromMatchingOutput } from "./post-processing/binding/reconstructHdRoutesFromMatchingOutput"
import { DifferentialPairRoutingError } from "./post-processing/errors/DifferentialPairRoutingError"
import { getDifferentialPairReroutingIterationLimit } from "./post-processing/routing/getDifferentialPairReroutingIterationLimit"
import {
  DifferentialPairReroutingSolver,
  type DifferentialPairReroutingOutput,
} from "./post-processing/solvers/DifferentialPairReroutingSolver"
import {
  FortyFiveDegreeSimplificationSolver,
  type FortyFiveDegreeSimplificationOutput,
} from "./post-processing/solvers/FortyFiveDegreeSimplificationSolver"
import { HdRouteReconstructionSolver } from "./post-processing/solvers/HdRouteReconstructionSolver"
import type {
  PostProcessingModel,
  PostProcessingError,
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
  private lengthMatchingBinding: LengthMatchingBinding | null = null
  private readonly model!: PostProcessingModel
  private fallbackOutput: PostProcessingSolverOutput | null = null
  private readonly postProcessingErrors: PostProcessingError[] = []

  override pipelineDef: PipelineStep<BaseSolver>[] = [
    definePipelineStep(
      "differentialPairReroutingSolver",
      DifferentialPairReroutingSolver,
      (pipeline: PostProcessingSolver) => [pipeline.getModel().params],
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
        const { obstacles, bounds, layerCount } =
          pipeline.getModel().params.simpleRouteJson
        return [{ ...rerouted, obstacles, bounds, layerCount }]
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
          params: pipeline.getModel().params,
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
            params: pipeline.getModel().params,
            model: pipeline.getModel(),
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
            skippedPairCount: rerouted.failures.length,
            postProcessingErrorCount: rerouted.failures.length,
          }
        },
      },
    ),
  ]

  constructor(params: PostProcessingSolverParams) {
    super(structuredClone(params))
    try {
      validatePostProcessingParams(params)
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
      this.finishWithBestEffortOutput(error, "validation")
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
      this.finishWithBestEffortOutput(error, this.getCurrentStageName())
      return
    }
    if (this.failed)
      this.finishWithBestEffortOutput(
        this.error ?? "PostProcessingSolver failed without an error message",
        this.getCurrentStageName(),
      )
  }

  override tryFinalAcceptance(): void {
    this.finishWithBestEffortOutput(
      "PostProcessingSolver reached its iteration limit",
      this.getCurrentStageName(),
    )
  }

  private getModel(): PostProcessingModel {
    if (!this.model)
      throw new Error("PostProcessingSolver: validated model is unavailable")
    return this.model
  }

  private createBestEffortOutput(): {
    output: PostProcessingSolverOutput
    source: PostProcessingError["returnedRouteSource"]
  } {
    if (!this.model)
      return {
        output: { hdRoutes: structuredClone(this.inputProblem.hdRoutes) },
        source: "input-hd-routes",
      }
    let binding = this.lengthMatchingBinding
    if (!binding) {
      const simplified =
        this.getStageOutput<FortyFiveDegreeSimplificationOutput>(
          "fortyFiveDegreeSimplificationSolver",
        ) ?? this.fortyFiveDegreeSimplificationSolver?.getBestEffortOutput()
      const rerouted =
        this.getStageOutput<DifferentialPairReroutingOutput>(
          "differentialPairReroutingSolver",
        ) ?? this.differentialPairReroutingSolver?.getBestEffortOutput()
      const bestSimplified = simplified ?? rerouted
      if (bestSimplified)
        binding = createLengthMatchingBinding({
          result: bestSimplified,
          params: this.model.params,
        })
    }
    if (!binding)
      return {
        output: { hdRoutes: structuredClone(this.inputProblem.hdRoutes) },
        source: "input-hd-routes",
      }
    const matched = this.getStageOutput<
      ReturnType<LengthMatchingSolver["getOutput"]>
    >("lengthMatchingSolver") ??
      this.lengthMatchingSolver?.getBestEffortOutput() ?? {
        matchedHdRoutes: binding.solverParams.hdRoutes,
      }
    try {
      return {
        output: reconstructHdRoutesFromMatchingOutput({
          binding,
          result: matched,
          model: this.model,
        }),
        source: "best-effort-hd-routes",
      }
    } catch {
      return {
        output: reconstructHdRoutesFromMatchingOutput({
          binding,
          result: { matchedHdRoutes: binding.solverParams.hdRoutes },
          model: this.model,
        }),
        source: "best-effort-hd-routes",
      }
    }
  }

  private finishWithBestEffortOutput(error: unknown, stage: string): void {
    let bestEffort: ReturnType<PostProcessingSolver["createBestEffortOutput"]>
    try {
      bestEffort = this.createBestEffortOutput()
    } catch {
      bestEffort = {
        output: { hdRoutes: structuredClone(this.inputProblem.hdRoutes) },
        source: "input-hd-routes",
      }
    }
    let message = String(error)
    if (error instanceof Error) message = error.message
    const connectionName = message.match(
      /(?:HD route|connection) "([^"]+)"/,
    )?.[1]
    const diagnostic: PostProcessingError = {
      type: "post_processing_error",
      stage,
      message,
      returnedRouteSource: bestEffort.source,
    }
    if (connectionName) diagnostic.connectionName = connectionName
    if (error instanceof DifferentialPairRoutingError) {
      diagnostic.connectionNames = [...error.connectionNames]
      diagnostic.reason = error.reason
    }
    this.postProcessingErrors.push(diagnostic)
    this.fallbackOutput = bestEffort.output
    this.activeSubSolver = null
    this.error = null
    this.failed = false
    this.solved = true
    this.progress = 1
    this.stats = {
      phase: "complete",
      postProcessingErrorCount: this.postProcessingErrors.length,
    }
  }

  override getOutput(): PostProcessingSolverOutput {
    if (!this.solved)
      throw new Error(
        "PostProcessingSolver: getOutput() called before the solver completed",
      )
    const output =
      this.fallbackOutput ??
      this.getStageOutput<PostProcessingSolverOutput>(
        "hdRouteReconstructionSolver",
      )
    if (!output)
      throw new Error(
        "PostProcessingSolver: completed pipeline is missing reconstruction output",
      )
    const rerouting =
      this.getStageOutput<DifferentialPairReroutingOutput>(
        "differentialPairReroutingSolver",
      ) ?? this.differentialPairReroutingSolver?.getBestEffortOutput()
    const reroutingFailures = rerouting?.failures ?? []
    let reroutingRouteSource: PostProcessingError["returnedRouteSource"] =
      "input-hd-routes"
    if ((rerouting?.reroutedPairs.length ?? 0) > 0)
      reroutingRouteSource = "best-effort-hd-routes"
    const errors = [
      ...reroutingFailures.map(
        (failure): PostProcessingError => ({
          type: "post_processing_error",
          stage: "differentialPairReroutingSolver",
          message: failure.message,
          connectionNames: [...failure.connectionNames],
          reason: failure.reason,
          returnedRouteSource: reroutingRouteSource,
        }),
      ),
      ...this.postProcessingErrors,
    ]
    const clonedOutput = structuredClone(output)
    if (errors.length > 0)
      clonedOutput.postProcessingErrors = structuredClone(errors)
    return clonedOutput
  }

  override initialVisualize(): GraphicsObject {
    if (this.fallbackOutput)
      return {
        lines: this.fallbackOutput.hdRoutes.map((route) => ({
          points: route.route.map(({ x, y }) => ({ x, y })),
          strokeWidth: route.traceThickness,
        })),
      }
    const { traces, obstacles, bounds, layerCount } =
      this.model.params.simpleRouteJson
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
  PostProcessingError,
  PostProcessingGridConfig,
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "./post-processing/types"
