import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { DifferentialPair, SimplifiedPcbTraces } from "../../types"
import { cloneSimplifiedPcbTraces } from "../model/cloneSimplifiedPcbTraces"
import {
  DifferentialPairRoutingError,
  type DifferentialPairRoutingFailureReason,
} from "../errors/DifferentialPairRoutingError"
import { DifferentialPairRoutingSession } from "../routing/DifferentialPairRoutingSession"
import type { InternalPostProcessingParams } from "../types"
import { createPostProcessingVisualization } from "../visualization/createPostProcessingVisualization"

export type DifferentialPairReroutingOutput = {
  traces: SimplifiedPcbTraces
  reroutedPairs: DifferentialPair[]
  failures: DifferentialPairReroutingFailure[]
}

export type DifferentialPairReroutingFailure = {
  connectionNames: [string, string]
  reason: DifferentialPairRoutingFailureReason
  message: string
}

/** Incrementally reroutes one declared differential pair at a time. */
export class DifferentialPairReroutingSolver extends BaseSolver {
  private readonly outputTraces: SimplifiedPcbTraces
  private readonly reroutedPairs: DifferentialPair[] = []
  private readonly failures: DifferentialPairReroutingFailure[] = []
  private nextPairIndex = 0
  private activeConnectionNames: [string, string] | null = null
  private activeSession: DifferentialPairRoutingSession | null = null
  private allocatedActiveSearchStateCount = 0

  constructor(private readonly params: InternalPostProcessingParams) {
    super()
    this.outputTraces = cloneSimplifiedPcbTraces(params.simpleRouteJson.traces)
    this.MAX_ITERATIONS = Math.max(
      1,
      params.simpleRouteJson.differentialPairs.length * 750_020,
    )
  }

  override getSolverName(): string {
    return "DifferentialPairReroutingSolver"
  }

  override _step(): void {
    const pair =
      this.params.simpleRouteJson.differentialPairs[this.nextPairIndex]
    if (!pair) {
      this.finish()
      return
    }
    this.activeConnectionNames = pair.connectionNames
    try {
      if (!this.activeSession) {
        this.activeSession = new DifferentialPairRoutingSession({
          pair,
          traces: this.outputTraces,
          obstacles: this.params.simpleRouteJson.obstacles,
          bounds: this.params.simpleRouteJson.bounds,
          layerCount: this.params.simpleRouteJson.layerCount,
          routingGrid: this.params.routingGrid,
        })
        this.stats = this.activeSession.getStats()
        return
      }
      this.activeSession.step()
    } catch (error) {
      if (!(error instanceof DifferentialPairRoutingError)) throw error
      this.skipFailedPair(pair, error)
      return
    }
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
    this.nextPairIndex++
    if (
      this.nextPairIndex ===
      this.params.simpleRouteJson.differentialPairs.length
    ) {
      this.finish()
      return
    }
    this.stats = {
      phase: "accepted",
      pair: pair.connectionNames.join("/"),
      pairIndex: this.nextPairIndex - 1,
      pairCount: this.params.simpleRouteJson.differentialPairs.length,
    }
  }

  private finish(): void {
    this.activeConnectionNames = null
    this.solved = true
    this.stats = {
      phase: "complete",
      acceptedPairCount: this.reroutedPairs.length,
      skippedPairCount: this.failures.length,
    }
  }

  private skipFailedPair(
    pair: DifferentialPair,
    error: DifferentialPairRoutingError,
  ): void {
    this.failures.push({
      connectionNames: [...pair.connectionNames],
      reason: error.reason,
      message: error.message,
    })
    this.activeSession = null
    this.allocatedActiveSearchStateCount = 0
    this.nextPairIndex++
    if (
      this.nextPairIndex ===
      this.params.simpleRouteJson.differentialPairs.length
    ) {
      this.finish()
      return
    }
    this.stats = {
      phase: "skipped",
      pair: pair.connectionNames.join("/"),
      pairIndex: this.nextPairIndex - 1,
      pairCount: this.params.simpleRouteJson.differentialPairs.length,
      skippedPairCount: this.failures.length,
    }
  }

  override getConstructorParams(): [InternalPostProcessingParams] {
    return [this.params]
  }

  override getOutput(): DifferentialPairReroutingOutput {
    if (!this.solved)
      throw new Error(
        "DifferentialPairReroutingSolver: getOutput() called before completion",
      )
    return this.getBestEffortOutput()
  }

  /** Returns all candidates committed before an interruption. */
  getBestEffortOutput(): DifferentialPairReroutingOutput {
    return {
      traces: cloneSimplifiedPcbTraces(this.outputTraces),
      reroutedPairs: this.reroutedPairs.map((pair) => ({
        ...pair,
        connectionNames: [...pair.connectionNames],
      })),
      failures: this.failures.map((failure) => ({
        ...failure,
        connectionNames: [...failure.connectionNames],
      })),
    }
  }

  computeProgress(): number {
    if (this.solved) return 1
    if (this.params.simpleRouteJson.differentialPairs.length === 0) return 0
    return (
      (this.nextPairIndex + (this.activeSession?.getProgress() ?? 0)) /
      this.params.simpleRouteJson.differentialPairs.length
    )
  }

  override visualize(): GraphicsObject {
    return createPostProcessingVisualization({
      traces: this.outputTraces,
      obstacles: this.params.simpleRouteJson.obstacles,
      bounds: this.params.simpleRouteJson.bounds,
      layerCount: this.params.simpleRouteJson.layerCount,
      activeConnectionNames: this.activeConnectionNames,
      previewPath: this.activeSession?.getPreviewPath() ?? null,
    })
  }
}
