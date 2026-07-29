import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import type {
  PostProcessingSolverOutput,
  PostProcessingSolverParams,
} from "../types"

/** Returns untouched HD routes when no differential pair needs post-processing. */
export class HdRoutePassthroughSolver extends BaseSolver {
  private output: PostProcessingSolverOutput | null = null

  constructor(
    private readonly params: Pick<PostProcessingSolverParams, "hdRoutes">,
  ) {
    super()
  }

  override getSolverName(): string {
    return "HdRoutePassthroughSolver"
  }

  override _step(): void {
    this.output = { hdRoutes: structuredClone(this.params.hdRoutes) }
    this.stats = { phase: "complete", routeCount: this.output.hdRoutes.length }
    this.solved = true
  }

  override getConstructorParams(): [
    Pick<PostProcessingSolverParams, "hdRoutes">,
  ] {
    return [structuredClone(this.params)]
  }

  override getOutput(): PostProcessingSolverOutput {
    if (!this.solved || !this.output)
      throw new Error(
        "HdRoutePassthroughSolver: getOutput() called before completion",
      )
    return structuredClone(this.output)
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.params.hdRoutes
        .filter((route) => route.route.length > 1)
        .map((route) => ({
          points: route.route.map((point) => ({ x: point.x, y: point.y })),
          strokeWidth: route.traceThickness,
        })),
    }
  }
}
