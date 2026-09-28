import {
  BasePipelineSolver,
  definePipelineStep,
  type BaseSolver,
  type PipelineStep,
} from "@tscircuit/solver-utils"
import { LengthMatchingSolver } from "./length-matching-solver"
import { InitialDifferentialPairRoutingSolver } from "./differential-pair-routing/InitialDifferentialPairRoutingSolver"
import type { DifferentialPairRoutingSrj } from "./differential-pair-routing/types"
import { prepareDifferentialPairRoutingSrj } from "./differential-pair-routing/prepareDifferentialPairRoutingSrj"
import {
  createLengthMatchingBinding,
  type LengthMatchingBinding,
} from "./post-processing/binding/createLengthMatchingBinding"
import { reconstructSimplifiedPcbTraces } from "./post-processing/binding/reconstructSimplifiedPcbTraces"
import { FortyFiveDegreeSimplificationSolver } from "./post-processing/solvers/FortyFiveDegreeSimplificationSolver"
import type { InternalPostProcessingParams } from "./post-processing/types"
import type { SimplifiedPcbTraces } from "./types"

type DifferentialPairRoutingOutput<Srj> = {
  srj: Srj
  routedTraces: SimplifiedPcbTraces
}

/** Route and length-match differential pairs before routing the remaining SRJ. */
export class DifferentialPairRoutingSolver<
  Srj extends DifferentialPairRoutingSrj = DifferentialPairRoutingSrj,
> extends BasePipelineSolver<Srj> {
  initialRoutingSolver?: InitialDifferentialPairRoutingSolver
  simplificationSolver?: FortyFiveDegreeSimplificationSolver
  lengthMatchingSolver?: LengthMatchingSolver
  private binding?: LengthMatchingBinding
  private output?: DifferentialPairRoutingOutput<Srj>
  private readonly matchingParams: InternalPostProcessingParams

  override pipelineDef: PipelineStep<BaseSolver>[] = [
    definePipelineStep(
      "initialRoutingSolver",
      InitialDifferentialPairRoutingSolver,
      (pipeline: DifferentialPairRoutingSolver) => [pipeline.inputProblem],
    ),
    definePipelineStep(
      "simplificationSolver",
      FortyFiveDegreeSimplificationSolver,
      (pipeline: DifferentialPairRoutingSolver) => [{
        ...pipeline.inputProblem,
        ...pipeline.initialRoutingSolver!.getOutput(),
      }],
    ),
    definePipelineStep(
      "lengthMatchingSolver",
      LengthMatchingSolver,
      (pipeline: DifferentialPairRoutingSolver) => {
        pipeline.matchingParams.simpleRouteJson.differentialPairs =
          pipeline.initialRoutingSolver!.getOutput().reroutedPairs
        pipeline.binding = createLengthMatchingBinding({
          result: pipeline.simplificationSolver!.getOutput(),
          params: pipeline.matchingParams,
        })
        return [pipeline.binding.solverParams]
      },
    ),
  ]

  constructor(srj: Srj) {
    super(prepareDifferentialPairRoutingSrj(srj))
    this.matchingParams = {
      simpleRouteJson: {
        ...this.inputProblem,
        traces: srj.traces ?? [],
        differentialPairs: srj.differentialPairs ?? [],
      },
    }
    this.MAX_ITERATIONS = (srj.differentialPairs?.length ?? 0) * 75_001 + 100_010
    if (!srj.differentialPairs?.length) {
      this.output = { srj: this.inputProblem, routedTraces: [] }
      this.solved = true
    }
  }

  override getConstructorParams(): [Srj] {
    return [this.inputProblem]
  }

  override getOutput(): DifferentialPairRoutingOutput<Srj> {
    if (!this.solved)
      throw new Error(
        "DifferentialPairRoutingSolver: output requested before completion",
      )
    if (this.output) return this.output
    const traces = reconstructSimplifiedPcbTraces({
      binding: this.binding!,
      result: this.lengthMatchingSolver!.getOutput(),
      simplified: this.simplificationSolver!.getOutput(),
      params: this.matchingParams,
    })
    const routedTraces = traces.slice(this.inputProblem.traces?.length ?? 0)
    for (const trace of routedTraces) {
      for (const point of trace.route) {
        if (point.route_type !== "via") continue
        point.via_hole_diameter =
          this.inputProblem.min_via_hole_diameter ??
          this.inputProblem.minViaHoleDiameter ??
          point.via_diameter! / 2
      }
    }
    const routedConnectionNames = new Set(
      routedTraces.map((trace) => trace.connection_name),
    )
    this.output = {
      srj: {
        ...this.inputProblem,
        connections: this.inputProblem.connections.filter(
          (connection) => !routedConnectionNames.has(connection.name),
        ),
        differentialPairs: [],
        traces,
      },
      routedTraces,
    }
    return this.output
  }
}
