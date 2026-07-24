import type {
  PcbLayer,
  PcbTraceRoutePoint,
  PcbViaForPostProcessing,
} from "../types"

export type Point = {
  x: number
  y: number
}

export type CoupledPathPoint = Point & {
  layer: PcbLayer
}

export type CoupledPathSearchState = CoupledPathPoint & {
  gridX: number
  gridY: number
  viaPairCount: number
  pathLength: number
  score: number
  directionIndex: number
  parent?: CoupledPathSearchState
}

export type PairLaneGeometry = {
  laneOffset: Point
  laneSideSign: 1 | -1
  targetSpacing: number
  positiveStart: Point
  negativeStart: Point
  positiveEnd: Point
  negativeEnd: Point
  startMidpoint: Point
  endMidpoint: Point
  startLayer: PcbLayer
  endLayer: PcbLayer
  positiveWidth: number
  negativeWidth: number
  effectiveMinimumSpacing: number
}

export type CoupledPathSearchResult =
  | {
      status: "routed"
      path: CoupledPathPoint[]
      viaPairCount: number
      exploredStateCount: number
    }
  | {
      status: "failed"
      hitIterationLimit: boolean
      exploredStateCount: number
    }

export type RoutedPairCandidate = {
  positiveRoute: PcbTraceRoutePoint[]
  negativeRoute: PcbTraceRoutePoint[]
  pcbVias: PcbViaForPostProcessing[]
}
