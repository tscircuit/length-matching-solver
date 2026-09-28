import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { IncrementalCoupledPathSearch } from "./post-processing/routing/IncrementalCoupledPathSearch"
import { createPostProcessingVisualization } from "./post-processing/visualization/createPostProcessingVisualization"
import { createRoutedTrace } from "./trace-routing/createRoutedTrace"
import { createTraceSearchInput } from "./trace-routing/createTraceSearchInput"
import type {
  TraceRoutingSolverOutput,
  TraceRoutingSolverParams,
} from "./trace-routing/types"
import type { HighDensityRoute, SimplifiedPcbTrace } from "./types"

/** Routes unrouted two-terminal connections one at a time on the composite grid. */
export class TraceRoutingSolver extends BaseSolver {
  private readonly hdRoutes: HighDensityRoute[] = []
  private readonly fixedTraces: SimplifiedPcbTrace[]
  private nextConnectionIndex = 0
  private search: IncrementalCoupledPathSearch | null = null

  constructor(private readonly params: TraceRoutingSolverParams) {
    super()
    const connectionNames = new Set<string>()
    for (const connection of params.connections) {
      if (connectionNames.has(connection.connectionName))
        throw new Error(
          `TraceRoutingSolver: connection "${connection.connectionName}" is declared more than once`,
        )
      connectionNames.add(connection.connectionName)
      if (
        !Number.isFinite(connection.traceThickness) ||
        connection.traceThickness <= 0 ||
        !Number.isFinite(connection.viaDiameter) ||
        connection.viaDiameter <= 0
      )
        throw new Error(
          `TraceRoutingSolver: connection "${connection.connectionName}" needs a positive trace thickness and via diameter`,
        )
    }
    this.fixedTraces = structuredClone(params.traces ?? [])
    // One search-creation step per connection plus the final step; each search
    // adds its own step bound once its grid exists.
    this.MAX_ITERATIONS = params.connections.length + 1
  }

  override getSolverName(): string {
    return "TraceRoutingSolver"
  }

  override getConstructorParams(): [TraceRoutingSolverParams] {
    return [this.params]
  }

  override _step(): void {
    const connection = this.params.connections[this.nextConnectionIndex]
    if (!connection) {
      this.solved = true
      return
    }
    if (!this.search) {
      this.search = new IncrementalCoupledPathSearch(
        createTraceSearchInput({
          connection,
          fixedTraces: this.fixedTraces,
          obstacles: this.params.obstacles,
          bounds: this.params.bounds,
          layerCount: this.params.layerCount,
          minTraceToPadEdgeClearance: this.params.minTraceToPadEdgeClearance,
          routingGrid: this.params.routingGrid,
        }),
      )
      this.MAX_ITERATIONS += this.search.getStepCountUpperBound()
      return
    }
    this.search.step()
    this.stats = {
      connection: connection.connectionName,
      connectionIndex: this.nextConnectionIndex,
      connectionCount: this.params.connections.length,
      exploredNodeCount: this.search.getExploredCount(),
    }
    if (!this.search.isComplete()) return
    const path = this.search.getPath()
    if (!path)
      throw new Error(
        `TraceRoutingSolver: connection "${connection.connectionName}" has no clear path; all ${this.search.getExploredCount()} reachable grid states were explored`,
      )
    const routed = createRoutedTrace({
      connection,
      path,
      layerCount: this.params.layerCount,
    })
    this.hdRoutes.push(routed.hdRoute)
    this.fixedTraces.push(routed.trace)
    this.search = null
    this.nextConnectionIndex++
  }

  computeProgress(): number {
    if (this.solved) return 1
    if (this.params.connections.length === 0) return 0
    return (
      (this.nextConnectionIndex + (this.search?.getProgress() ?? 0)) /
      this.params.connections.length
    )
  }

  override getOutput(): TraceRoutingSolverOutput {
    if (!this.solved)
      throw new Error(
        "TraceRoutingSolver: getOutput() called before the solver completed",
      )
    return { hdRoutes: structuredClone(this.hdRoutes) }
  }

  override visualize(): GraphicsObject {
    return createPostProcessingVisualization({
      traces: this.fixedTraces,
      obstacles: this.params.obstacles,
      bounds: this.params.bounds,
      layerCount: this.params.layerCount,
      activeConnectionNames: null,
      previewPath: this.search?.getPreviewPath() ?? null,
    })
  }
}
