import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { DifferentialPairRoutingError } from "../post-processing/errors/DifferentialPairRoutingError"
import { DifferentialPairRoutingSession } from "../post-processing/routing/DifferentialPairRoutingSession"
import type { FortyFiveDegreeSimplificationOutput } from "../post-processing/solvers/FortyFiveDegreeSimplificationSolver"
import { createPostProcessingVisualization } from "../post-processing/visualization/createPostProcessingVisualization"
import type { DifferentialPair, SimplifiedPcbTraces } from "../types"
import { getInitialTerminalFanoutGeometry } from "./getInitialTerminalFanoutGeometry"
import { createPairTerminalTraces } from "./createPairTerminalTraces"
import type { DifferentialPairRoutingSrj } from "./types"

type PairRoutingChoice = {
  pair: DifferentialPair
  session: DifferentialPairRoutingSession
}

/** Search compatible coupled routes; each selected pair becomes fixed copper. */
export class InitialDifferentialPairRoutingSolver extends BaseSolver {
  private readonly traces: SimplifiedPcbTraces
  private readonly reroutedPairs: DifferentialPair[] = []
  private readonly choices: PairRoutingChoice[] = []
  private session: DifferentialPairRoutingSession | null = null
  private pair: DifferentialPair | null = null

  constructor(private readonly srj: DifferentialPairRoutingSrj) {
    super()
    this.traces = structuredClone(srj.traces ?? [])
    this.MAX_ITERATIONS = Math.max(
      1,
      (srj.differentialPairs?.length ?? 0) * 75_000 + 1,
    )
  }

  override _step(): void {
    const declaredPair = this.srj.differentialPairs?.[this.reroutedPairs.length]
    if (!declaredPair) {
      this.solved = true
      return
    }
    if (!this.session) {
      const connections = declaredPair.connectionNames.map((name) => {
        const connection = this.srj.connections.find(
          (connection) => connection.name === name,
        )
        if (!connection)
          throw new Error(
            `DifferentialPairRoutingSolver: missing connection "${name}"`,
          )
        return connection
      })
      const terminalTraces = createPairTerminalTraces(connections, this.srj)
      const traceIds = new Set(this.traces.map((trace) => trace.pcb_trace_id))
      for (const trace of terminalTraces) {
        while (traceIds.has(trace.pcb_trace_id)) trace.pcb_trace_id += "_"
        traceIds.add(trace.pcb_trace_id)
      }
      this.pair = { ...declaredPair }
      if (declaredPair.traceGap !== undefined) {
        const centerlineDistance =
          declaredPair.traceGap +
          connections.reduce(
            (total, connection) =>
              total +
              (connection.nominalTraceWidth ??
                this.srj.nominalTraceWidth ??
                this.srj.minTraceWidth) /
                2,
            0,
          )
        this.pair.minimumCenterlineDistance = centerlineDistance
        this.pair.maximumCenterlineDistance = centerlineDistance
      }
      this.session = new DifferentialPairRoutingSession({
        ...this.srj,
        pair: this.pair,
        terminalFanoutGeometry: getInitialTerminalFanoutGeometry(connections),
        traces: [...this.traces, ...terminalTraces],
      })
      return
    }
    const candidate = this.session.advanceCandidateSearch()
    this.stats = this.session.getStats()
    if (candidate === "searching") return
    if (candidate !== "exhausted") {
      this.choices.push({ pair: this.pair!, session: this.session })
      this.traces.push(candidate.first, candidate.second)
      this.reroutedPairs.push(this.pair!)
      this.session = null
      return
    }
    const choice = this.choices.pop()
    if (choice) {
      this.traces.splice(-2)
      this.reroutedPairs.pop()
      this.pair = choice.pair
      this.session = choice.session
      return
    }
    throw new DifferentialPairRoutingError({
      connectionNames: this.pair!.connectionNames,
      reason: "no-valid-candidate",
      message:
        "has no compatible coupled routes after searching earlier pair candidates",
    })
  }

  override getConstructorParams(): [DifferentialPairRoutingSrj] {
    return [this.srj]
  }

  override getOutput(): FortyFiveDegreeSimplificationOutput {
    if (!this.solved)
      throw new Error("DifferentialPairRoutingSolver: routing is not complete")
    return { traces: this.traces, reroutedPairs: this.reroutedPairs }
  }

  override visualize(): GraphicsObject {
    return createPostProcessingVisualization({
      ...this.srj,
      traces: this.traces,
      activeConnectionNames: this.pair?.connectionNames ?? null,
      previewPath: this.session?.getPreviewPath() ?? null,
    })
  }
}
