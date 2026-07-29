import type {
  DifferentialPair,
  Obstacle,
  SimplifiedPcbTrace,
  SimplifiedPcbTraceRoutePoint,
  SimplifiedPcbTraces,
} from "../types"

export type PostProcessingGridConfig = {
  /** Fine grid step used throughout the board interior, in board units. */
  innerGridStep?: number
  /** Coarse grid step used in the outer perimeter, in board units. */
  outerGridStep?: number
  /** Width of the coarse perimeter band, in board units. */
  outerPerimeterWidth?: number
}

export type SimpleRouteJson = {
  layerCount: number
  obstacles: Obstacle[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  differentialPairs?: DifferentialPair[]
  traces?: SimplifiedPcbTraces
}

export type CompleteSimpleRouteJson<
  TSimpleRouteJson extends SimpleRouteJson = SimpleRouteJson,
> = TSimpleRouteJson & {
  differentialPairs: DifferentialPair[]
  traces: SimplifiedPcbTraces
}

type ReconstructedTrace<TTrace extends SimplifiedPcbTrace> = Omit<
  TTrace,
  "route"
> & {
  route: SimplifiedPcbTraceRoutePoint[]
}

export type PostProcessedSimpleRouteJson<
  TSimpleRouteJson extends SimpleRouteJson,
> = Omit<TSimpleRouteJson, "traces"> & {
  traces: Array<
    ReconstructedTrace<NonNullable<TSimpleRouteJson["traces"]>[number]>
  >
}

export type PostProcessingSolverParams<
  TSimpleRouteJson extends SimpleRouteJson = CompleteSimpleRouteJson,
> = {
  simpleRouteJson: TSimpleRouteJson
  routingGrid?: PostProcessingGridConfig
}

export type PostProcessingSolverOutput<
  TSimpleRouteJson extends SimpleRouteJson = CompleteSimpleRouteJson,
> = {
  simpleRouteJson: PostProcessedSimpleRouteJson<TSimpleRouteJson>
}
