import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type { DifferentialPair, SimplifiedPcbTraces } from "../../types"
import { cloneSimplifiedPcbTraces } from "../model/cloneSimplifiedPcbTraces"
import { simplifyDifferentialPairTo45Degrees } from "../smoothing/simplifyDifferentialPairTo45Degrees"
import type { SimpleRouteJson } from "../types"
import { createPostProcessingVisualization } from "../visualization/createPostProcessingVisualization"
import type { DifferentialPairReroutingOutput } from "./DifferentialPairReroutingSolver"

export type FortyFiveDegreeSimplificationInput = Pick<
  SimpleRouteJson,
  "obstacles" | "bounds" | "layerCount"
> &
  DifferentialPairReroutingOutput

export type FortyFiveDegreeSimplificationOutput = {
  traces: SimplifiedPcbTraces
  reroutedPairs: DifferentialPair[]
}

/** Simplifies each successfully rerouted pair without changing layers or vias. */
export class FortyFiveDegreeSimplificationSolver extends BaseSolver {
  private traces: SimplifiedPcbTraces
  private nextPairIndex = 0

  constructor(private readonly input: FortyFiveDegreeSimplificationInput) {
    super()
    this.traces = cloneSimplifiedPcbTraces(input.traces)
    this.MAX_ITERATIONS = Math.max(1, input.reroutedPairs.length + 1)
  }

  override getSolverName(): string {
    return "FortyFiveDegreeSimplificationSolver"
  }

  override _step(): void {
    const pair = this.input.reroutedPairs[this.nextPairIndex]
    if (!pair) {
      this.solved = true
      this.stats = {
        phase: "complete",
        simplifiedPairCount: this.nextPairIndex,
      }
      return
    }
    this.traces = simplifyDifferentialPairTo45Degrees({
      traces: this.traces,
      pair,
      obstacles: this.input.obstacles,
      bounds: this.input.bounds,
      layerCount: this.input.layerCount,
    })
    this.nextPairIndex++
    this.stats = {
      phase: "simplifying",
      pair: pair.connectionNames.join("/"),
      pairIndex: this.nextPairIndex - 1,
      pairCount: this.input.reroutedPairs.length,
    }
  }

  override getConstructorParams(): [FortyFiveDegreeSimplificationInput] {
    return [this.input]
  }

  override getOutput(): FortyFiveDegreeSimplificationOutput {
    if (!this.solved)
      throw new Error(
        "FortyFiveDegreeSimplificationSolver: getOutput() called before completion",
      )
    return {
      traces: cloneSimplifiedPcbTraces(this.traces),
      reroutedPairs: this.input.reroutedPairs.map((pair) => ({
        ...pair,
        connectionNames: [...pair.connectionNames],
      })),
    }
  }

  computeProgress(): number {
    if (this.solved) return 1
    if (this.input.reroutedPairs.length === 0) return 0
    return this.nextPairIndex / this.input.reroutedPairs.length
  }

  override visualize(): GraphicsObject {
    return createPostProcessingVisualization({
      traces: this.traces,
      obstacles: this.input.obstacles,
      bounds: this.input.bounds,
      layerCount: this.input.layerCount,
      activeConnectionNames:
        this.input.reroutedPairs[this.nextPairIndex]?.connectionNames ?? null,
      previewPath: null,
    })
  }
}
