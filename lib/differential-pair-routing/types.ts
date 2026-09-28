import type {
  DifferentialPair,
  Obstacle,
  SimpleRouteConnection,
  SimplifiedPcbTraces,
} from "../types"

/** Native SRJ fields needed to route differential pairs before ordinary nets. */
export type DifferentialPairRoutingSrj = {
  layerCount: number
  minTraceWidth: number
  nominalTraceWidth?: number
  minViaDiameter?: number
  minViaHoleDiameter?: number
  min_via_hole_diameter?: number
  minViaPadDiameter?: number
  min_via_pad_diameter?: number
  minTraceToPadEdgeClearance?: number
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  obstacles: Obstacle[]
  connections: Array<SimpleRouteConnection & {
    __rootConnectionNames?: string[]
    __netConnectionName?: string
  }>
  differentialPairs?: Array<DifferentialPair & { traceGap?: number }>
  traces?: SimplifiedPcbTraces
}
