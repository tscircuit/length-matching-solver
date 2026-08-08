import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { solveDifferentialPair } from "./solveDifferentialPair"
import type {
  DifferentialPairPostProcessingSolverOutput,
  DifferentialPairPostProcessingSolverParams,
  PcbTraceForPostProcessing,
  PcbViaForPostProcessing,
  ResolvedDifferentialPair,
  ResolvedDifferentialPairPostProcessingParams,
} from "./types"
import { validateDifferentialPairPostProcessingParams } from "./validateDifferentialPairPostProcessingParams"

export class DifferentialPairPostProcessingSolver extends BaseSolver {
  private readonly resolvedParams: ResolvedDifferentialPairPostProcessingParams
  private readonly canonicalPairs: ResolvedDifferentialPair[]
  private readonly transactionalPcbTraces: PcbTraceForPostProcessing[]
  private readonly transactionalPcbVias: PcbViaForPostProcessing[]
  private readonly pairResults: DifferentialPairPostProcessingSolverOutput["pairResults"] =
    []
  private nextPairIndex = 0
  private output: DifferentialPairPostProcessingSolverOutput | null = null

  constructor(
    private readonly params: DifferentialPairPostProcessingSolverParams,
  ) {
    super()
    this.resolvedParams = validateDifferentialPairPostProcessingParams(params)
    this.canonicalPairs = this.resolvedParams.differentialPairs
      .slice()
      .sort((pairA, pairB) =>
        pairA.name < pairB.name ? -1 : pairA.name > pairB.name ? 1 : 0,
      )
    this.transactionalPcbTraces = structuredClone(this.resolvedParams.pcbTraces)
    this.transactionalPcbVias = structuredClone(this.resolvedParams.pcbVias)
    this.MAX_ITERATIONS = this.canonicalPairs.length + 1
  }

  override getSolverName(): string {
    return "DifferentialPairPostProcessingSolver"
  }

  override getConstructorParams(): [
    DifferentialPairPostProcessingSolverParams,
  ] {
    return [this.params]
  }

  override _step(): void {
    const pair = this.canonicalPairs[this.nextPairIndex]
    if (!pair) {
      this.output = { pairResults: structuredClone(this.pairResults) }
      this.progress = 1
      this.solved = true
      this.stats = {
        phase: "finalize_output",
        routedPairCount: this.pairResults.filter(
          (pairResult) => pairResult.status === "routed",
        ).length,
        retainedPairCount: this.pairResults.filter(
          (pairResult) => pairResult.status === "original_retained",
        ).length,
      }
      return
    }
    this.stats = {
      phase: "route_coupled_centerlines",
      differentialPairName: pair.name,
      pairIndex: this.nextPairIndex,
      pairCount: this.canonicalPairs.length,
    }
    const attempt = solveDifferentialPair({
      pair,
      params: this.resolvedParams,
      transactionalPcbTraces: this.transactionalPcbTraces,
      transactionalPcbVias: this.transactionalPcbVias,
    })
    if (attempt.status === "failed") {
      this.pairResults.push({
        status: "original_retained",
        differentialPairName: pair.name,
        failure: attempt.failure,
      })
    } else {
      this.pairResults.push({
        status: "routed",
        differentialPairName: pair.name,
        ...attempt.routedPair,
      })
      const replacementPcbTraceIds = new Set(
        [
          attempt.routedPair.positivePcbTrace,
          attempt.routedPair.negativePcbTrace,
        ].map((pcbTrace) => pcbTrace.pcb_trace_id),
      )
      for (const replacementPcbTrace of [
        attempt.routedPair.positivePcbTrace,
        attempt.routedPair.negativePcbTrace,
      ]) {
        const pcbTraceIndex = this.transactionalPcbTraces.findIndex(
          (pcbTrace) =>
            pcbTrace.pcb_trace_id === replacementPcbTrace.pcb_trace_id,
        )
        if (pcbTraceIndex < 0) {
          throw new Error(
            `Differential pair "${pair.name}" replaced an unknown PCB trace`,
          )
        }
        this.transactionalPcbTraces[pcbTraceIndex] =
          structuredClone(replacementPcbTrace)
      }
      for (
        let pcbViaIndex = this.transactionalPcbVias.length - 1;
        pcbViaIndex >= 0;
        pcbViaIndex--
      ) {
        const pcbVia = this.transactionalPcbVias[pcbViaIndex]!
        if (
          pcbVia.pcb_trace_id &&
          replacementPcbTraceIds.has(pcbVia.pcb_trace_id)
        ) {
          this.transactionalPcbVias.splice(pcbViaIndex, 1)
        }
      }
      this.transactionalPcbVias.push(
        ...structuredClone(attempt.routedPair.pcbVias),
      )
    }
    this.nextPairIndex++
    this.progress = this.nextPairIndex / (this.canonicalPairs.length + 1)
  }

  override getOutput(): DifferentialPairPostProcessingSolverOutput {
    if (!this.solved || !this.output)
      throw new Error(
        "DifferentialPairPostProcessingSolver: getOutput() called before the solver completed",
      )
    return structuredClone(this.output)
  }

  override visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
      texts: [],
    }
    graphics.rects!.push({
      center: {
        x:
          (this.resolvedParams.board.minX + this.resolvedParams.board.maxX) / 2,
        y:
          (this.resolvedParams.board.minY + this.resolvedParams.board.maxY) / 2,
      },
      width: this.resolvedParams.board.maxX - this.resolvedParams.board.minX,
      height: this.resolvedParams.board.maxY - this.resolvedParams.board.minY,
      fill: "rgba(20, 25, 35, 0.08)",
      stroke: "rgba(150, 170, 200, 0.8)",
      layer: "board",
    })
    for (const obstacle of this.resolvedParams.obstacles) {
      if (obstacle.type === "rect") {
        graphics.rects!.push({
          center: obstacle.center,
          width: obstacle.width,
          height: obstacle.height,
          ccwRotationDegrees: obstacle.ccwRotationDegrees,
          fill: "rgba(220, 80, 80, 0.15)",
          stroke: "rgba(220, 80, 80, 0.8)",
          layer: obstacle.layers.join(","),
        })
      } else {
        graphics.circles!.push({
          center: obstacle.center,
          radius: obstacle.radius,
          fill: "rgba(220, 80, 80, 0.15)",
          stroke: "rgba(220, 80, 80, 0.8)",
          layer: obstacle.layers.join(","),
        })
      }
    }
    const positiveSourceTraceIds = new Set(
      this.canonicalPairs.map((pair) => pair.positiveSourceTraceId),
    )
    for (const pcbTrace of this.transactionalPcbTraces) {
      let previousWire:
        | Extract<
            PcbTraceForPostProcessing["route"][number],
            { route_type: "wire" }
          >
        | undefined
      for (const routePoint of pcbTrace.route) {
        if (routePoint.route_type === "via") {
          previousWire = undefined
          continue
        }
        if (routePoint.route_type !== "wire") continue
        if (previousWire && previousWire.layer === routePoint.layer) {
          graphics.lines!.push({
            points: [previousWire, routePoint],
            strokeColor: positiveSourceTraceIds.has(pcbTrace.source_trace_id)
              ? "#e05a5a"
              : "#5a8fe0",
            strokeWidth: routePoint.width,
            layer: routePoint.layer,
          })
        }
        previousWire = routePoint
      }
    }
    for (const pcbVia of this.transactionalPcbVias) {
      graphics.circles!.push({
        center: pcbVia,
        radius: pcbVia.outer_diameter / 2,
        fill: "rgba(230, 190, 70, 0.5)",
        stroke: "#e6be46",
        layer: pcbVia.layers.join(","),
      })
    }
    graphics.texts!.push({
      x: this.resolvedParams.board.minX,
      y: this.resolvedParams.board.maxY + 0.5,
      text:
        this.pairResults.length === 0
          ? "Differential-pair coupled routing: pending"
          : this.pairResults
              .map((pairResult) =>
                pairResult.status === "routed"
                  ? `${pairResult.differentialPairName}: routed`
                  : `${pairResult.differentialPairName}: retained (${pairResult.failure.category})`,
              )
              .join(" | "),
      anchorSide: "bottom_left",
      fontSize: 0.35,
      layer: "annotations",
    })
    return graphics
  }
}
