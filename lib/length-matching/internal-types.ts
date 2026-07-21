import type { DifferentialPair, Obstacle, RoutePoint } from "../types"

export type MeanderPlacement = "balanced" | "negative" | "positive"
export type MeanderHeightProfile = "tapered" | "uniform"

/** One straight route segment and square-wave configuration to evaluate. */
export type SegmentCandidate = {
  routeIndex: number
  segmentIndex: number
  segmentLength: number
  toothCount: number
  maximumDepth: number
  minimumHeight: number
  toothPitch: number
  placement: MeanderPlacement
  heightProfile: MeanderHeightProfile
}

type RegressionAttemptInvalidReason =
  | "invalid-scale"
  | "below-minimum-height"
  | "target-error"
  | "invalid-geometry"

type RegressionAttemptOutcome =
  | { valid: true; invalidReason: null }
  | { valid: false; invalidReason: RegressionAttemptInvalidReason }

/** Measured regression result retained for solver diagnostics and visualization. */
export type RegressionAttempt = SegmentCandidate &
  RegressionAttemptOutcome & {
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
    maximumAddedLength: number
    resultingError: number
    testedSegment: [RoutePoint, RoutePoint]
    meanderPoints: RoutePoint[]
    qualityScore: number
  }

/** A fitted meander attempt that satisfies every geometry and length constraint. */
export type ValidRegressionAttempt = Extract<RegressionAttempt, { valid: true }>

export type ActivePair = {
  pair: DifferentialPair
  longerConnectionName: string
  longerRouteIndexes: number[]
  shorterConnectionName: string
  targetAddedLength: number
  remainingAddedLength: number
  candidates: SegmentCandidate[]
  candidateIndex: number
  lastMatchedSegmentIndexByRoute: Map<number, number>
  partialAttempts: RegressionAttempt[]
  fullAttempts: RegressionAttempt[]
  plannedAttemptTargets: Map<string, PlannedAttemptTarget> | null
  hasMinimumHeightBlockedAttempt: boolean
}

export type PlannedAttemptTarget = {
  routeIndex: number
  segmentIndex: number
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
