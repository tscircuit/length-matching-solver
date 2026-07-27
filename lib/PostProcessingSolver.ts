import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { cloneSimplifiedPcbTraces } from "./post-processing/model/cloneSimplifiedPcbTraces"
import { DifferentialPairRoutingSession } from "./post-processing/routing/DifferentialPairRoutingSession"
import type {
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "./post-processing/types"
import { validatePostProcessingParams } from "./post-processing/validation/validatePostProcessingParams"
import { createPostProcessingVisualization } from "./post-processing/visualization/createPostProcessingVisualization"

/** Incrementally post-processes one declared differential pair per step. */
export class PostProcessingSolver extends BaseSolver {
  private readonly outputTraces: PostProcessingSolverOutput["traces"]
  private readonly errors: Error[] = []
  private nextPairIndex = 0
  private activeConnectionNames: [string, string] | null = null
  private activeSession: DifferentialPairRoutingSession | null = null

  constructor(private readonly params: PostProcessingSolverParams) {
    super()
    validatePostProcessingParams(params)
    this.outputTraces = cloneSimplifiedPcbTraces(params.traces)
    this.MAX_ITERATIONS = Math.max(1, params.differentialPairs.length * 750_020)
  }

  override getSolverName(): string {
    return "PostProcessingSolver"
  }

  override _step(): void {
    const pair = this.params.differentialPairs[this.nextPairIndex]
    if (!pair) {
      this.activeConnectionNames = null
      this.solved = true
      this.stats = {
        phase: "complete",
        acceptedPairCount: this.nextPairIndex - this.errors.length,
        retainedPairCount: this.errors.length,
      }
      return
    }
    this.activeConnectionNames = pair.connectionNames
    if (!this.activeSession) {
      this.activeSession = new DifferentialPairRoutingSession({
        pair,
        traces: this.outputTraces,
        obstacles: this.params.obstacles,
        bounds: this.params.bounds,
        layerCount: this.params.layerCount,
      })
      this.stats = this.activeSession.getStats()
      return
    }
    this.activeSession.step()
    this.stats = this.activeSession.getStats()
    if (!this.activeSession.isComplete()) return
    const result = this.activeSession.getResult()
    this.activeSession = null
    if (result.status === "retained") {
      this.errors.push(result.error)
    } else {
      for (const replacement of [result.candidate.first, result.candidate.second]) {
        const index = this.outputTraces.findIndex(
          (trace) => trace.connection_name === replacement.connection_name,
        )
        if (index < 0)
          throw new Error(
            `PostProcessingSolver: accepted replacement for unknown connection "${replacement.connection_name}"`,
          )
        this.outputTraces[index] = replacement
      }
    }
    this.nextPairIndex++
    if (this.nextPairIndex === this.params.differentialPairs.length) {
      this.activeConnectionNames = null
      this.solved = true
      this.stats = {
        phase: "complete",
        acceptedPairCount: this.nextPairIndex - this.errors.length,
        retainedPairCount: this.errors.length,
      }
      return
    }
    this.stats = {
      phase: result.status,
      pair: pair.connectionNames.join("/"),
      pairIndex: this.nextPairIndex - 1,
      pairCount: this.params.differentialPairs.length,
      errorCount: this.errors.length,
    }
  }

  override getConstructorParams(): [PostProcessingSolverParams] {
    return [this.params]
  }

  override getOutput(): PostProcessingSolverOutput {
    if (!this.solved)
      throw new Error(
        "PostProcessingSolver: getOutput() called before the solver completed",
      )
    return {
      traces: cloneSimplifiedPcbTraces(this.outputTraces),
      errors: this.errors.map((error) => new Error(error.message)),
    }
  }

  computeProgress(): number {
    if (this.solved) return 1
    if (this.params.differentialPairs.length === 0) return 0
    return (
      this.nextPairIndex + (this.activeSession?.getProgress() ?? 0)
    ) / this.params.differentialPairs.length
  }

  override visualize(): GraphicsObject {
    return createPostProcessingVisualization({
      traces: this.outputTraces,
      obstacles: this.params.obstacles,
      bounds: this.params.bounds,
      layerCount: this.params.layerCount,
      activeConnectionNames: this.activeConnectionNames,
      previewPath: this.activeSession?.getPreviewPath() ?? null,
    })
  }
}

export type {
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "./post-processing/types"
