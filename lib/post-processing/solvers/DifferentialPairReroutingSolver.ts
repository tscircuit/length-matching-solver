import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { DifferentialPair, SimplifiedPcbTraces } from "../../types"
import { cloneSimplifiedPcbTraces } from "../model/cloneSimplifiedPcbTraces"
import { DifferentialPairRoutingSession } from "../routing/DifferentialPairRoutingSession"
import type { PostProcessingSolverParams } from "../types"
import { createPostProcessingVisualization } from "../visualization/createPostProcessingVisualization"

export type DifferentialPairReroutingOutput = {
  traces: SimplifiedPcbTraces
  errors: Error[]
  reroutedPairs: DifferentialPair[]
}

/** Incrementally reroutes one declared differential pair at a time. */
export class DifferentialPairReroutingSolver extends BaseSolver {
  private readonly outputTraces: SimplifiedPcbTraces
  private readonly errors: Error[] = []
  private readonly reroutedPairs: DifferentialPair[] = []
  private nextPairIndex = 0
  private activeConnectionNames: [string, string] | null = null
  private activeSession: DifferentialPairRoutingSession | null = null
  private allocatedActiveSearchStateCount = 0

  constructor(private readonly params: PostProcessingSolverParams) {
    super()
    this.outputTraces = cloneSimplifiedPcbTraces(params.traces)
    this.MAX_ITERATIONS = Math.max(1, params.differentialPairs.length * 750_020)
  }

  override getSolverName(): string {
    return "DifferentialPairReroutingSolver"
  }

  override _step(): void {
    const pair = this.params.differentialPairs[this.nextPairIndex]
    if (!pair) {
      this.finish()
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
        routingGrid: this.params.routingGrid,
      })
      this.stats = this.activeSession.getStats()
      return
    }
    this.activeSession.step()
    const allocatedSearchStateCount =
      this.activeSession.getAllocatedSearchStateCount()
    if (allocatedSearchStateCount > this.allocatedActiveSearchStateCount) {
      this.MAX_ITERATIONS +=
        allocatedSearchStateCount - this.allocatedActiveSearchStateCount
      this.allocatedActiveSearchStateCount = allocatedSearchStateCount
    }
    this.stats = this.activeSession.getStats()
    if (!this.activeSession.isComplete()) return

    const result = this.activeSession.getResult()
    this.activeSession = null
    this.allocatedActiveSearchStateCount = 0
    if (result.status === "retained") {
      this.errors.push(result.error)
    } else {
      for (const replacement of [
        result.candidate.first,
        result.candidate.second,
      ]) {
        const index = this.outputTraces.findIndex(
          (trace) => trace.connection_name === replacement.connection_name,
        )
        if (index < 0)
          throw new Error(
            `DifferentialPairReroutingSolver: accepted replacement for unknown connection "${replacement.connection_name}"`,
          )
        this.outputTraces[index] = replacement
      }
      this.reroutedPairs.push(pair)
    }
    this.nextPairIndex++
    if (this.nextPairIndex === this.params.differentialPairs.length) {
      this.finish()
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

  private finish(): void {
    this.activeConnectionNames = null
    this.solved = true
    this.stats = {
      phase: "complete",
      acceptedPairCount: this.reroutedPairs.length,
      retainedPairCount: this.errors.length,
    }
  }

  override getConstructorParams(): [PostProcessingSolverParams] {
    return [this.params]
  }

  override getOutput(): DifferentialPairReroutingOutput {
    if (!this.solved)
      throw new Error(
        "DifferentialPairReroutingSolver: getOutput() called before completion",
      )
    return {
      traces: cloneSimplifiedPcbTraces(this.outputTraces),
      errors: this.errors.map((error) => new Error(error.message)),
      reroutedPairs: this.reroutedPairs.map((pair) => ({
        ...pair,
        connectionNames: [...pair.connectionNames],
      })),
    }
  }

  computeProgress(): number {
    if (this.solved) return 1
    if (this.params.differentialPairs.length === 0) return 0
    return (
      (this.nextPairIndex + (this.activeSession?.getProgress() ?? 0)) /
      this.params.differentialPairs.length
    )
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
