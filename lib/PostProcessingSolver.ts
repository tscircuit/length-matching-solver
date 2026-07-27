import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { cloneSimplifiedPcbTraces } from "./post-processing/model/cloneSimplifiedPcbTraces"
import { solveDifferentialPair } from "./post-processing/routing/solveDifferentialPair"
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

  constructor(private readonly params: PostProcessingSolverParams) {
    super()
    validatePostProcessingParams(params)
    this.outputTraces = cloneSimplifiedPcbTraces(params.traces)
    this.MAX_ITERATIONS = Math.max(1, params.differentialPairs.length)
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
    const result = solveDifferentialPair({
      pair,
      traces: this.outputTraces,
      obstacles: this.params.obstacles,
      bounds: this.params.bounds,
      layerCount: this.params.layerCount,
    })
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
    return this.nextPairIndex / this.params.differentialPairs.length
  }

  override visualize(): GraphicsObject {
    return createPostProcessingVisualization({
      traces: this.outputTraces,
      obstacles: this.params.obstacles,
      bounds: this.params.bounds,
      layerCount: this.params.layerCount,
      activeConnectionNames: this.activeConnectionNames,
    })
  }
}

export type {
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "./post-processing/types"
