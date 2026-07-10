import type { DifferentialPair, Obstacle, RoutePoint } from "../types"

export type MeanderPlacement = "balanced" | "negative" | "positive"

/** One straight route segment and square-wave configuration to evaluate. */
export type SegmentCandidate = {
  routeIndex: number
  segmentIndex: number
  segmentLength: number
  toothCount: number
  maximumDepth: number
  toothPitch: number
  placement: MeanderPlacement
}

/** Measured regression result retained for solver diagnostics and visualization. */
export type RegressionAttempt = SegmentCandidate & {
  connectionName: string
  sampleDepths: [number, number]
  sampleAddedLengths: [number, number]
  slope: number
  intercept: number
  predictedDepth: number
  predictedRoute: RoutePoint[]
  resultingError: number
  testedSegment: [RoutePoint, RoutePoint]
  meanderPoints: RoutePoint[]
  valid: boolean
}

export type ActivePair = {
  pair: DifferentialPair
  shorterConnectionName: string
  targetAddedLength: number
  candidates: SegmentCandidate[]
  candidateIndex: number
}

export type LengthMatchingConfig = {
  maximumMeanderDepth: number
  minimumToothPitch?: number
  maxToothCount: number
  obstacles: Obstacle[]
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  obstacleMargin: number
  layerCount: number
  colorMap: Record<string, string>
}
