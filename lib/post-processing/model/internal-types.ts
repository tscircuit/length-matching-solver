import type {
  SimplifiedPcbTrace,
  SimplifiedPcbTraceViaRoutePoint,
} from "../../types"

export type Point = { x: number; y: number }

export type PathPoint = Point & {
  layer: string
  width: number
}

export type CopperSegment = {
  start: Point
  end: Point
  layer: string
  width: number
  connectionName: string
  terminal: "start" | "end" | "both" | null
}

export type CopperVia = Point & {
  layers: string[]
  diameter: number
  connectionName: string
  terminal: "start" | "end" | "both" | null
}

export type ParsedTrace = {
  source: SimplifiedPcbTrace
  points: PathPoint[]
  segments: CopperSegment[]
  vias: CopperVia[]
  transitions: SimplifiedPcbTraceViaRoutePoint[]
  width: number
  viaDiameter: number
  startPortId?: string
  endPortId?: string
}

export type PairCandidate = {
  first: SimplifiedPcbTrace
  second: SimplifiedPcbTrace
  firstParsed: ParsedTrace
  secondParsed: ParsedTrace
  edgeGap: number
  centerlineDistance: number
  bendCount: number
  viaPairCount: number
}

export type PairSolveResult = {
  status: "accepted"
  candidate: PairCandidate
}
