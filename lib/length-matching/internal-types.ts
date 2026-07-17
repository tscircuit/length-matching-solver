import type { DifferentialPair, Obstacle, RoutePoint } from "../types"
import type { StraightRouteSpan } from "./straight-route-spans"

export type MeanderPlacement = "balanced" | "negative" | "positive"
export type MeanderHeightProfile = "tapered" | "uniform"

/** One straight route span and square-wave configuration to evaluate. */
export type SegmentCandidate = {
  routeIndex: number
  span: StraightRouteSpan
  toothCount: number
  maximumDepth: number
  minimumHeight: number
  toothPitch: number
  placement: MeanderPlacement
  heightProfile: MeanderHeightProfile
}

/** Measured regression result retained for solver diagnostics and visualization. */
export type RegressionAttempt = SegmentCandidate & {
  connectionName: string
  maximumToothDepths: number[]
  sampleScaleFactors: [number, number]
  sampleAddedLengths: [number, number]
  slope: number
  intercept: number
  predictedScaleFactor: number
  predictedToothDepths: number[]
  predictedRoute: RoutePoint[]
  addedLength: number
  resultingError: number
  testedSegment: [RoutePoint, RoutePoint]
  meanderPoints: RoutePoint[]
  qualityScore: number
  valid: boolean
}

export type ActivePair = {
  pair: DifferentialPair
  shorterConnectionName: string
  targetAddedLength: number
  remainingAddedLength: number
  candidates: SegmentCandidate[]
  candidateIndex: number
  lastMatchedSegmentIndexByRoute: Map<number, number>
  partialAttempts: RegressionAttempt[]
  fullAttempts: RegressionAttempt[]
  plannedAttemptTargets: Map<string, PlannedAttemptTarget> | null
}

export type PlannedAttemptTarget = {
  routeIndex: number
  span: StraightRouteSpan
  targetAddedLength: number
}

export type LengthMatchingConfig = {
  maximumMeanderDepth: number
  minimumToothPitch?: number
  minMeanderGap?: number
  minMeanderHeight?: number
  maxToothCount: number
  obstacles: Obstacle[]
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  obstacleMargin: number
  layerCount: number
  colorMap: Record<string, string>
}
