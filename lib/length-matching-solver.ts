import { doSegmentsIntersect } from "@tscircuit/math-utils"
import { BaseSolver } from "@tscircuit/solver-utils"
import type { Circle, GraphicsObject, Line, Point, Rect } from "graphics-debug"
import { transparentize } from "polished"
import type {
  DifferentialPair,
  HighDensityRoute,
  Obstacle,
  SimpleRouteConnection,
} from "./types"

type Point2D = { x: number; y: number }

const pointToSegmentDistance = (
  point: Point2D,
  segmentStart: Point2D,
  segmentEnd: Point2D,
): number => {
  const segment = {
    x: segmentEnd.x - segmentStart.x,
    y: segmentEnd.y - segmentStart.y,
  }
  const fromStart = {
    x: point.x - segmentStart.x,
    y: point.y - segmentStart.y,
  }
  const segmentLengthSquared = segment.x ** 2 + segment.y ** 2
  const projection =
    segmentLengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            (fromStart.x * segment.x + fromStart.y * segment.y) /
              segmentLengthSquared,
          ),
        )
  return Math.hypot(
    point.x - (segmentStart.x + projection * segment.x),
    point.y - (segmentStart.y + projection * segment.y),
  )
}

const minimumDistanceBetweenSegments = (
  firstStart: Point2D,
  firstEnd: Point2D,
  secondStart: Point2D,
  secondEnd: Point2D,
): number => {
  if (doSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return 0
  return Math.min(
    pointToSegmentDistance(firstStart, secondStart, secondEnd),
    pointToSegmentDistance(firstEnd, secondStart, secondEnd),
    pointToSegmentDistance(secondStart, firstStart, firstEnd),
    pointToSegmentDistance(secondEnd, firstStart, firstEnd),
  )
}

const getStringColor = (value: string): string => {
  if (!value) return "rgba(0, 0, 0, 0.5)"
  const characterSum = value
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0)
  return `hsl(${((characterSum * 300) / value.length) % 360}, 100%, 50%)`
}

const safeTransparentize = (color: string, amount: number): string => {
  try {
    return transparentize(amount, color)
  } catch {
    return color
  }
}

const mapLayerNameToZ = (layerName: string, layerCount: number): number => {
  if (layerName === "top") return 0
  if (layerName === "bottom") return layerCount - 1
  const innerLayerIndex = Number.parseInt(layerName.replace("inner", ""), 10)
  if (!Number.isInteger(innerLayerIndex)) {
    throw new Error(`LengthMatchingSolver: unknown layer name "${layerName}"`)
  }
  return innerLayerIndex
}

const getGraphicsLayerForObstacle = (
  obstacle: Obstacle,
  layerCount: number,
): string =>
  `z${obstacle.layers
    .map((layerName) => mapLayerNameToZ(layerName, layerCount))
    .join(",")}`

type RoutePoint = HighDensityRoute["route"][number]

type SegmentCandidate = {
  routeIndex: number
  segmentIndex: number
  segmentLength: number
  toothCount: number
  maximumDepth: number
  toothPitch: number
  placement: "balanced" | "negative" | "positive"
}

type RegressionAttempt = SegmentCandidate & {
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

type ActivePair = {
  pair: DifferentialPair
  shorterConnectionName: string
  targetAddedLength: number
  candidates: SegmentCandidate[]
  candidateIndex: number
}

export type LengthMatchingSolverParams = {
  hdRoutes: HighDensityRoute[]
  originalConnections: SimpleRouteConnection[]
  differentialPairs?: DifferentialPair[]
  /** Maximum perpendicular excursion allowed by this simple solver. */
  maximumMeanderDepth?: number
  /** Minimum along-segment allocation for one square-wave tooth. */
  minimumToothPitch?: number
  maxToothCount?: number
  obstacles?: Obstacle[]
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  obstacleMargin?: number
  layerCount?: number
  colorMap?: Record<string, string>
}

export type LengthMatchingSolverOutput = {
  matchedHdRoutes: HighDensityRoute[]
}

const getLogicalConnectionName = (route: HighDensityRoute): string =>
  route.rootConnectionName ?? route.connectionName

const getSegmentLength = (start: RoutePoint, end: RoutePoint): number =>
  Math.hypot(end.x - start.x, end.y - start.y)

const getRouteLength = (route: HighDensityRoute): number => {
  let length = 0
  for (let index = 0; index < route.route.length - 1; index++) {
    length += getSegmentLength(route.route[index]!, route.route[index + 1]!)
  }
  return length
}

const replaceSegmentWithMeander = (input: {
  route: HighDensityRoute
  segmentIndex: number
  toothCount: number
  toothPitch: number
  depth: number
  placement: "balanced" | "negative" | "positive"
}): RoutePoint[] => {
  const start = input.route.route[input.segmentIndex]!
  const end = input.route.route[input.segmentIndex + 1]!
  const segmentLength = getSegmentLength(start, end)
  const tangent = {
    x: (end.x - start.x) / segmentLength,
    y: (end.y - start.y) / segmentLength,
  }
  const leadLength =
    (segmentLength - input.toothCount * input.toothPitch) / 2
  const replacement: RoutePoint[] = [{ ...start }]

  for (let toothIndex = 0; toothIndex < input.toothCount; toothIndex++) {
    const normalSign =
      input.placement === "balanced"
        ? toothIndex % 2 === 0
          ? -1
          : 1
        : input.placement === "negative"
          ? -1
          : 1
    const normal = {
      x: -tangent.y * normalSign,
      y: tangent.x * normalSign,
    }
    const entryDistance = leadLength + toothIndex * input.toothPitch
    const exitDistance = entryDistance + input.toothPitch / 2
    const entry = {
      ...start,
      x: start.x + tangent.x * entryDistance,
      y: start.y + tangent.y * entryDistance,
    }
    const upperEntry = {
      ...entry,
      x: entry.x + normal.x * input.depth,
      y: entry.y + normal.y * input.depth,
    }
    const upperExit = {
      ...start,
      x: start.x + tangent.x * exitDistance + normal.x * input.depth,
      y: start.y + tangent.y * exitDistance + normal.y * input.depth,
    }
    const exit = {
      ...start,
      x: start.x + tangent.x * exitDistance,
      y: start.y + tangent.y * exitDistance,
    }
    replacement.push(entry)
    replacement.push(upperEntry, upperExit, exit)
  }

  replacement.push({ ...end })
  return [
    ...input.route.route.slice(0, input.segmentIndex),
    ...replacement,
    ...input.route.route.slice(input.segmentIndex + 2),
  ]
}

/**
 * Adds a square-wave meander to the shorter member of a differential pair.
 *
 * This intentionally small first implementation searches straight route
 * segments, both perpendicular sides, and tooth-count combinations. For every
 * combination it measures two depths, fits
 * `addedLength = slope * depth + intercept`, and predicts a one-shot depth.
 * A candidate is accepted only when it stays inside the board bounds, clears
 * obstacles and other connections, and measures within the requested
 * tolerance.
 */
export class LengthMatchingSolver extends BaseSolver {
  override getSolverName(): string {
    return "LengthMatchingSolver"
  }

  matchedHdRoutes: HighDensityRoute[]
  private readonly pairs: DifferentialPair[]
  private nextPairIndex = 0
  private activePair: ActivePair | null = null
  private currentAttempt: RegressionAttempt | null = null
  private paramsValidated = false
  private readonly colorMap: Record<string, string>
  private candidatesTried = 0

  constructor(private readonly params: LengthMatchingSolverParams) {
    super()
    this.MAX_ITERATIONS = 100_000
    this.matchedHdRoutes = params.hdRoutes.map((route) => ({
      ...route,
      route: route.route.map((point) => ({ ...point })),
    }))
    this.pairs = params.differentialPairs ?? []
    this.colorMap = params.colorMap ?? {}
  }

  private validatePair(pair: DifferentialPair): void {
    if (pair.connectionNames[0] === pair.connectionNames[1]) {
      throw new Error(
        "LengthMatchingSolver: a differential pair must reference two distinct connections",
      )
    }
    if (!Number.isFinite(pair.lengthTolerance) || pair.lengthTolerance < 0) {
      throw new Error(
        "LengthMatchingSolver: differential pair lengthTolerance must be a non-negative finite number",
      )
    }
    const connectionsByName = new Map(
      this.params.originalConnections.map((connection) => [
        connection.name,
        connection,
      ]),
    )
    for (const connectionName of pair.connectionNames) {
      const connection = connectionsByName.get(connectionName)
      if (!connection) {
        throw new Error(
          `LengthMatchingSolver: differential pair references unknown connection "${connectionName}"`,
        )
      }
      if (connection.pointsToConnect.length !== 2) {
        throw new Error(
          `LengthMatchingSolver: differential pair connection "${connectionName}" must have exactly two points before MST splitting`,
        )
      }
    }
  }

  private validateParams(): void {
    const maximumDepth = this.params.maximumMeanderDepth ?? 5
    const toothPitch = this.params.minimumToothPitch
    const maxToothCount = this.params.maxToothCount ?? 12
    if (!Number.isFinite(maximumDepth) || maximumDepth <= 0) {
      throw new Error(
        "LengthMatchingSolver: maximumMeanderDepth must be a positive finite number",
      )
    }
    if (
      toothPitch !== undefined &&
      (!Number.isFinite(toothPitch) || toothPitch <= 0)
    ) {
      throw new Error(
        "LengthMatchingSolver: minimumToothPitch must be a positive finite number",
      )
    }
    if (
      !Number.isFinite(maxToothCount) ||
      !Number.isInteger(maxToothCount) ||
      maxToothCount <= 0
    ) {
      throw new Error(
        "LengthMatchingSolver: maxToothCount must be a positive finite integer",
      )
    }
    this.paramsValidated = true
  }

  private getConnectionRouteIndexes(connectionName: string): number[] {
    return this.matchedHdRoutes.flatMap((route, routeIndex) =>
      getLogicalConnectionName(route) === connectionName ? [routeIndex] : [],
    )
  }

  private getConnectionLength(routeIndexes: number[]): number {
    return routeIndexes.reduce(
      (total, routeIndex) => total + getRouteLength(this.matchedHdRoutes[routeIndex]!),
      0,
    )
  }

  private createSegmentCandidates(routeIndexes: number[]): SegmentCandidate[] {
    const maximumDepth = this.params.maximumMeanderDepth ?? 5
    const maxToothCount = this.params.maxToothCount ?? 12
    const candidates: SegmentCandidate[] = []

    for (const routeIndex of routeIndexes) {
      const route = this.matchedHdRoutes[routeIndex]!
      const toothPitch =
        this.params.minimumToothPitch ?? Math.max(route.traceThickness * 4, 0.2)
      for (let segmentIndex = 0; segmentIndex < route.route.length - 1; segmentIndex++) {
        const start = route.route[segmentIndex]!
        const end = route.route[segmentIndex + 1]!
        const segmentLength = getSegmentLength(start, end)
        if (segmentLength <= 0 || start.z !== end.z) continue
        const toothCapacity = Math.min(
          Math.max(0, Math.floor(segmentLength / toothPitch) - 2),
          maxToothCount,
        )
        for (let toothCount = 1; toothCount <= toothCapacity; toothCount++) {
          const placements: SegmentCandidate["placement"][] =
            toothCount % 2 === 0
              ? ["balanced", "negative", "positive"]
              : ["negative", "positive"]
          for (const placement of placements) {
            candidates.push({
              routeIndex,
              segmentIndex,
              segmentLength,
              toothCount,
              maximumDepth,
              toothPitch,
              placement,
            })
          }
        }
      }
    }

    const placementPriority = { balanced: 0, negative: 1, positive: 2 }
    return candidates.sort((a, b) => {
      return (
        a.toothCount - b.toothCount ||
        placementPriority[a.placement] - placementPriority[b.placement] ||
        b.segmentLength - a.segmentLength
      )
    })
  }

  private isObstacleOnLayer(obstacle: Obstacle, z: number): boolean {
    if (obstacle.zLayers) return obstacle.zLayers.includes(z)
    const layerCount = this.params.layerCount ?? 2
    return obstacle.layers.some(
      (layer) =>
        (layer === "top" && z === 0) ||
        (layer === "bottom" && z === layerCount - 1) ||
        layer === `inner${z}`,
    )
  }

  private segmentTouchesInflatedObstacle(
    start: RoutePoint,
    end: RoutePoint,
    obstacle: Obstacle,
    margin: number,
  ): boolean {
    const minX = obstacle.center.x - obstacle.width / 2 - margin
    const maxX = obstacle.center.x + obstacle.width / 2 + margin
    const minY = obstacle.center.y - obstacle.height / 2 - margin
    const maxY = obstacle.center.y + obstacle.height / 2 + margin
    if (
      (start.x >= minX && start.x <= maxX && start.y >= minY && start.y <= maxY) ||
      (end.x >= minX && end.x <= maxX && end.y >= minY && end.y <= maxY)
    ) {
      return true
    }
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ]
    return corners.some((corner, index) =>
      minimumDistanceBetweenSegments(
        start,
        end,
        corner,
        corners[(index + 1) % corners.length]!,
      ) === 0,
    )
  }

  private isCandidateGeometryValid(
    route: HighDensityRoute,
    meanderPoints: RoutePoint[],
  ): boolean {
    const bounds = this.params.bounds
    if (
      bounds &&
      meanderPoints.some(
        (point) =>
          point.x < bounds.minX ||
          point.x > bounds.maxX ||
          point.y < bounds.minY ||
          point.y > bounds.maxY,
      )
    ) {
      return false
    }

    const connectionName = getLogicalConnectionName(route)
    const obstacleMargin =
      route.traceThickness / 2 + (this.params.obstacleMargin ?? 0.15)
    for (let index = 0; index < meanderPoints.length - 1; index++) {
      const start = meanderPoints[index]!
      const end = meanderPoints[index + 1]!
      for (const obstacle of this.params.obstacles ?? []) {
        if (!this.isObstacleOnLayer(obstacle, start.z)) {
          continue
        }
        const isTerminalLead =
          index === 0 || index === meanderPoints.length - 2
        if (
          obstacle.connectedTo.includes(connectionName) &&
          isTerminalLead
        ) {
          continue
        }
        if (this.segmentTouchesInflatedObstacle(start, end, obstacle, obstacleMargin)) {
          return false
        }
      }
      for (const otherRoute of this.matchedHdRoutes) {
        if (getLogicalConnectionName(otherRoute) === connectionName) continue
        for (
          let otherIndex = 0;
          otherIndex < otherRoute.route.length - 1;
          otherIndex++
        ) {
          const otherStart = otherRoute.route[otherIndex]!
          const otherEnd = otherRoute.route[otherIndex + 1]!
          if (start.z !== otherStart.z || start.z !== otherEnd.z) continue
          const requiredDistance =
            route.traceThickness / 2 +
            otherRoute.traceThickness / 2 +
            (this.params.obstacleMargin ?? 0.15)
          if (
            minimumDistanceBetweenSegments(start, end, otherStart, otherEnd) <
            requiredDistance
          ) {
            return false
          }
        }
      }
    }
    return true
  }

  private startNextPair(): void {
    const pair = this.pairs[this.nextPairIndex++]
    if (!pair) {
      this.solved = true
      return
    }
    this.validatePair(pair)
    const firstIndexes = this.getConnectionRouteIndexes(pair.connectionNames[0])
    const secondIndexes = this.getConnectionRouteIndexes(pair.connectionNames[1])

    if (firstIndexes.length === 0 && secondIndexes.length === 0) return
    if (firstIndexes.length === 0 || secondIndexes.length === 0) {
      throw new Error(
        `LengthMatchingSolver: differential pair ${pair.connectionNames.join("/")} has routed geometry for only one connection`,
      )
    }

    const firstLength = this.getConnectionLength(firstIndexes)
    const secondLength = this.getConnectionLength(secondIndexes)
    const difference = Math.abs(firstLength - secondLength)
    if (difference <= pair.lengthTolerance) return

    const firstIsShorter = firstLength < secondLength
    const shorterConnectionName = pair.connectionNames[firstIsShorter ? 0 : 1]
    const shorterIndexes = firstIsShorter ? firstIndexes : secondIndexes
    const candidates = this.createSegmentCandidates(shorterIndexes)
    if (candidates.length === 0) {
      throw new Error(
        `LengthMatchingSolver: no same-layer straight segment can tune connection "${shorterConnectionName}"`,
      )
    }

    this.activePair = {
      pair,
      shorterConnectionName,
      targetAddedLength: difference,
      candidates,
      candidateIndex: 0,
    }
  }

  private tryCandidate(candidate: SegmentCandidate): void {
    const activePair = this.activePair!
    const route = this.matchedHdRoutes[candidate.routeIndex]!
    const originalLength = getRouteLength(route)
    const sampleDepths: [number, number] = [
      candidate.maximumDepth * 0.25,
      candidate.maximumDepth * 0.75,
    ]
    const sampleAddedLengths = sampleDepths.map((depth) => {
      const sampledRoute = replaceSegmentWithMeander({ ...candidate, route, depth })
      return getRouteLength({ ...route, route: sampledRoute }) - originalLength
    }) as [number, number]
    const slope =
      (sampleAddedLengths[1] - sampleAddedLengths[0]) /
      (sampleDepths[1] - sampleDepths[0])
    const intercept = sampleAddedLengths[0] - slope * sampleDepths[0]
    const predictedDepth = (activePair.targetAddedLength - intercept) / slope
    const predictedRoute = replaceSegmentWithMeander({
      ...candidate,
      route,
      depth: predictedDepth,
    })
    const predictedRouteLength = getRouteLength({ ...route, route: predictedRoute })
    const resultingError = Math.abs(
      activePair.targetAddedLength - (predictedRouteLength - originalLength),
    )

    const replacementPointCount = candidate.toothCount * 4 + 2
    const meanderPoints = predictedRoute.slice(
      candidate.segmentIndex,
      candidate.segmentIndex + replacementPointCount,
    )
    const valid =
      Number.isFinite(predictedDepth) &&
      predictedDepth > 0 &&
      predictedDepth <= candidate.maximumDepth &&
      resultingError <= activePair.pair.lengthTolerance &&
      this.isCandidateGeometryValid(route, meanderPoints)
    this.currentAttempt = {
      ...candidate,
      connectionName: activePair.shorterConnectionName,
      sampleDepths,
      sampleAddedLengths,
      slope,
      intercept,
      predictedDepth,
      predictedRoute,
      resultingError,
      testedSegment: [
        { ...route.route[candidate.segmentIndex]! },
        { ...route.route[candidate.segmentIndex + 1]! },
      ],
      meanderPoints,
      valid,
    }
    this.candidatesTried++
    this.stats = {
      pair: `${activePair.pair.connectionNames[0]}/${activePair.pair.connectionNames[1]}`,
      candidatesTried: this.candidatesTried,
      segmentIndex: candidate.segmentIndex,
      toothCount: candidate.toothCount,
      placement: candidate.placement,
      predictedDepth,
      resultingError,
      accepted: valid,
    }
    if (!valid) return

    this.matchedHdRoutes[candidate.routeIndex] = { ...route, route: predictedRoute }
    this.activePair = null
  }

  override _step(): void {
    if (!this.paramsValidated) {
      this.validateParams()
      return
    }
    if (!this.activePair) {
      this.startNextPair()
      return
    }

    const candidate =
      this.activePair.candidates[this.activePair.candidateIndex++]
    if (!candidate) {
      throw new Error(
        `LengthMatchingSolver: linear regression exhausted all segment/tooth combinations for "${this.activePair.shorterConnectionName}"; required ${this.activePair.targetAddedLength.toFixed(4)}mm`,
      )
    }
    this.tryCandidate(candidate)
  }

  override getConstructorParams(): [LengthMatchingSolverParams] {
    return [this.params]
  }

  getOutput(): LengthMatchingSolverOutput {
    if (!this.solved) {
      throw new Error(
        "LengthMatchingSolver: getOutput() called before the solver completed",
      )
    }
    return { matchedHdRoutes: this.matchedHdRoutes }
  }

  computeProgress(): number {
    if (this.solved) return 1
    if (this.pairs.length === 0) return this.paramsValidated ? 1 : 0
    const completedPairFraction = Math.max(0, this.nextPairIndex - 1)
    const activePairFraction = this.activePair
      ? this.activePair.candidateIndex / this.activePair.candidates.length
      : 0
    return Math.min(
      0.99,
      (completedPairFraction + activePairFraction) / this.pairs.length,
    )
  }

  override visualize(): GraphicsObject {
    const lines: Line[] = []
    const points: Point[] = []
    const rects: Rect[] = []
    const circles: Circle[] = []
    const layerCount = this.params.layerCount ?? 2

    if (this.params.bounds) {
      const { minX, maxX, minY, maxY } = this.params.bounds
      rects.push({
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        width: maxX - minX,
        height: maxY - minY,
        fill: "rgba(30,41,59,0.03)",
        stroke: "rgba(30,41,59,0.55)",
        label: "board bounds",
        layer: `z${Array.from({ length: layerCount }, (_, z) => z).join(",")}`,
      })
    }

    for (const route of this.matchedHdRoutes) {
      const connectionName = getLogicalConnectionName(route)
      const connectionColor =
        this.colorMap[connectionName] ??
        this.colorMap[route.connectionName] ??
        getStringColor(connectionName)
      for (let index = 0; index < route.route.length - 1; index++) {
        const start = route.route[index]!
        const end = route.route[index + 1]!
        if (start.z !== end.z) continue
        lines.push({
          points: [start, end],
          strokeColor:
            start.z === 0
              ? connectionColor
              : safeTransparentize(connectionColor, 0.5),
          strokeWidth: route.traceThickness,
          ...(start.z === 0 ? {} : { strokeDash: [0.2, 0.2] }),
          layer: `z${start.z}`,
        })
      }
      for (const via of route.vias) {
        const routeLayers = [...new Set(route.route.map((point) => point.z))]
        circles.push({
          center: via,
          radius: route.viaDiameter / 2,
          fill: "blue",
          stroke: "none",
          layer: `z${routeLayers.join(",")}`,
        })
      }
    }

    for (const obstacle of this.params.obstacles ?? []) {
      rects.push({
        center: obstacle.center,
        width: obstacle.width,
        height: obstacle.height,
        ccwRotationDegrees: obstacle.ccwRotationDegrees,
        fill: "rgba(255,0,0,0.25)",
        stroke: "rgba(255,0,0,0.5)",
        layer: getGraphicsLayerForObstacle(obstacle, layerCount),
        label: obstacle.obstacleId ?? obstacle.componentId ?? "obstacle",
      })
    }

    if (this.currentAttempt) {
      const route = this.matchedHdRoutes[this.currentAttempt.routeIndex]!
      const [start, end] = this.currentAttempt.testedSegment
      const connectionColor =
        this.colorMap[this.currentAttempt.connectionName] ??
        getStringColor(this.currentAttempt.connectionName)
      lines.push({
        points: [start, end],
        strokeColor: safeTransparentize(connectionColor, 0.55),
        strokeWidth: route.traceThickness,
        strokeDash: [0.15, 0.15],
        label: `tested segment\n${this.currentAttempt.toothCount} teeth`,
        layer: `z${start.z}`,
      })
      if (!this.currentAttempt.valid) {
        lines.push({
          points: this.currentAttempt.meanderPoints.map(({ x, y }) => ({ x, y })),
          strokeColor: safeTransparentize(connectionColor, 0.45),
          strokeWidth: route.traceThickness,
          strokeDash: [0.1, 0.1],
          label: [
            `candidate rejected`,
            `depth ${this.currentAttempt.predictedDepth.toFixed(3)}`,
            `error ${this.currentAttempt.resultingError.toFixed(5)}`,
          ].join("\n"),
          layer: `z${start.z}`,
        })
      }
      points.push(
        {
          x: start.x,
          y: start.y,
          color: connectionColor,
          label: `${this.currentAttempt.connectionName}\nsegment start`,
          layer: `z${start.z}`,
        },
        {
          x: end.x,
          y: end.y,
          color: connectionColor,
          label: `${this.currentAttempt.connectionName}\nsegment end`,
          layer: `z${end.z}`,
        },
      )
    }

    return {
      title: "Length matching: linear-regression meander search",
      lines,
      points,
      rects,
      circles,
    }
  }
}
