import type { CoupledPathPoint, CoupledPathSearchInput } from "./types"

type PlanarPoint = { x: number; y: number }
type GridNode = { point: PlanarPoint; neighborIds: Set<number> }
type BoundarySide = "left" | "right" | "bottom" | "top"

const DIRECTIONS = [
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
  { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
]

/** Provides adjacency from an A02-style coarse perimeter and fine interior. */
export class CompositeRoutingGrid {
  private readonly nodes: GridNode[] = []
  private readonly nodeIdByPoint = new Map<string, number>()
  private readonly endpointNodeIdByPoint = new Map<string, number>()

  constructor(private readonly input: CoupledPathSearchInput) {
    const { bounds, grid } = input
    const innerBounds = {
      minX: bounds.minX + grid.outerPerimeterWidth,
      maxX: bounds.maxX - grid.outerPerimeterWidth,
      minY: bounds.minY + grid.outerPerimeterWidth,
      maxY: bounds.maxY - grid.outerPerimeterWidth,
    }
    const outerX = this.createAxis(bounds.minX, bounds.maxX, grid.outerGridStep, [innerBounds.minX, innerBounds.maxX])
    const outerY = this.createAxis(bounds.minY, bounds.maxY, grid.outerGridStep, [innerBounds.minY, innerBounds.maxY])
    const innerX = this.createAxis(innerBounds.minX, innerBounds.maxX, grid.innerGridStep, [], input.start.x)
    const innerY = this.createAxis(innerBounds.minY, innerBounds.maxY, grid.innerGridStep, [], input.start.y)
    const outerIds = this.createGrid(outerX, outerY, (point) =>
      point.x <= innerBounds.minX || point.x >= innerBounds.maxX ||
      point.y <= innerBounds.minY || point.y >= innerBounds.maxY,
    )
    const innerIds = this.createGrid(innerX, innerY, () => true)

    this.connectLocalNeighbors(outerIds)
    this.connectLocalNeighbors(innerIds)
    for (const side of ["left", "right", "bottom", "top"] as const)
      this.connectBoundaries(side, outerIds, innerIds, innerBounds)

    const regularNodeIds = this.nodes.map((_, index) => index)
    this.connectEndpoint(input.start, regularNodeIds)
    this.connectEndpoint(input.end, regularNodeIds)
  }

  getPlanarNeighbors(point: CoupledPathPoint): CoupledPathPoint[] {
    const nodeId = this.endpointNodeIdByPoint.get(this.exactKeyFor(point)) ??
      this.nodeIdByPoint.get(this.keyFor(point))
    if (nodeId === undefined)
      throw new Error(`PostProcessingSolver: coupled path point (${point.x}, ${point.y}) is not on the composite grid`)
    return [...this.nodes[nodeId]!.neighborIds].map((neighborId) => ({
      ...this.nodes[neighborId]!.point,
      layer: point.layer,
    }))
  }

  getNodeCount(): number {
    const nodeCount = this.nodes.length
    return nodeCount
  }

  getSearchStateCountUpperBound(layerCount: number): number {
    const directionalStateCount = this.nodes.reduce(
      (count, node) => count + node.neighborIds.size,
      0,
    )
    const stateCount = directionalStateCount * layerCount + 1
    if (!Number.isSafeInteger(stateCount))
      throw new Error("PostProcessingSolver: composite-grid search-state bound exceeds the safe integer range")
    return stateCount
  }

  private createAxis(
    minimum: number,
    maximum: number,
    step: number,
    mandatory: number[],
    anchor = minimum,
  ): number[] {
    const values = [minimum, maximum, ...mandatory].map((value) => ({ value, fixed: true }))
    const firstIndex = Math.ceil((minimum - anchor) / step)
    for (let index = firstIndex; anchor + index * step < maximum - 1e-8; index++)
      values.push({ value: anchor + index * step, fixed: false })
    values.sort((left, right) => left.value - right.value || Number(right.fixed) - Number(left.fixed))
    const unique: Array<{ value: number; fixed: boolean }> = []
    for (const entry of values) {
      const previous = unique.at(-1)
      if (!previous || Math.abs(entry.value - previous.value) > 1e-8)
        unique.push(entry)
      else if (entry.fixed && !previous.fixed)
        unique[unique.length - 1] = entry
    }
    return unique.map((entry) => entry.value)
  }

  private createGrid(
    xValues: number[],
    yValues: number[],
    include: (point: PlanarPoint) => boolean,
  ): Array<Array<number | null>> {
    return yValues.map((y) => xValues.map((x) => {
      const point = { x, y }
      return include(point) ? this.addNode(point) : null
    }))
  }

  private connectLocalNeighbors(ids: Array<Array<number | null>>): void {
    for (let row = 0; row < ids.length; row++) {
      for (let column = 0; column < (ids[row]?.length ?? 0); column++) {
        const nodeId = ids[row]![column]
        if (nodeId === null) continue
        for (const direction of DIRECTIONS) {
          const neighborId = ids[row + direction.y]?.[column + direction.x]
          if (neighborId === undefined || neighborId === null) continue
          this.connect(nodeId, neighborId)
        }
      }
    }
  }

  private connectBoundaries(
    side: BoundarySide,
    outerIds: Array<Array<number | null>>,
    innerIds: Array<Array<number | null>>,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
  ): void {
    const coordinate = side === "left" ? bounds.minX
      : side === "right" ? bounds.maxX
        : side === "bottom" ? bounds.minY
          : bounds.maxY
    const isVertical = side === "left" || side === "right"
    const isOnSide = (point: PlanarPoint): boolean =>
      Math.abs((isVertical ? point.x : point.y) - coordinate) <= 1e-8
    const collect = (ids: Array<Array<number | null>>): number[] => {
      const result = new Set<number>()
      for (const row of ids) for (const id of row)
        if (id !== null && isOnSide(this.nodes[id]!.point)) result.add(id)
      return [...result].sort((left, right) => {
        const a = this.nodes[left]!.point
        const b = this.nodes[right]!.point
        return (isVertical ? a.y - b.y : a.x - b.x) || left - right
      })
    }
    const outer = collect(outerIds)
    const inner = collect(innerIds)
    if (outer.length === 0 || inner.length === 0)
      throw new Error(`PostProcessingSolver: composite grid has no ${side} boundary bridge candidates`)
    for (const source of outer) this.connect(source, this.findNearestAlongBoundary(source, inner, isVertical))
    for (const source of inner) this.connect(source, this.findNearestAlongBoundary(source, outer, isVertical))
  }

  private findNearestAlongBoundary(sourceId: number, candidates: number[], isVertical: boolean): number {
    const source = this.nodes[sourceId]!.point
    let nearestId = candidates[0]!
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const candidateId of candidates) {
      const candidate = this.nodes[candidateId]!.point
      const distance = Math.abs(isVertical ? source.y - candidate.y : source.x - candidate.x)
      if (distance < nearestDistance - 1e-8 || (Math.abs(distance - nearestDistance) <= 1e-8 && candidateId < nearestId)) {
        nearestDistance = distance
        nearestId = candidateId
      }
    }
    return nearestId
  }

  private connectEndpoint(endpoint: CoupledPathPoint, regularNodeIds: number[]): void {
    const regularId = this.nodeIdByPoint.get(this.keyFor(endpoint))
    const regularPoint = regularId === undefined ? null : this.nodes[regularId]!.point
    const endpointId = regularPoint?.x === endpoint.x && regularPoint.y === endpoint.y
      ? regularId!
      : this.nodes.push({ point: { x: endpoint.x, y: endpoint.y }, neighborIds: new Set() }) - 1
    this.endpointNodeIdByPoint.set(this.exactKeyFor(endpoint), endpointId)
    const connectToNearest = (sourceId: number, count: number): void => {
      const source = this.nodes[sourceId]!.point
      const nearest = regularNodeIds
        .filter((nodeId) => nodeId !== sourceId)
        .map((nodeId) => ({
          nodeId,
          distance: Math.hypot(
            this.nodes[nodeId]!.point.x - source.x,
            this.nodes[nodeId]!.point.y - source.y,
          ),
        }))
        .filter(({ distance }) => distance > 1e-10)
        .sort((left, right) => left.distance - right.distance || left.nodeId - right.nodeId)
        .slice(0, count)
      if (nearest.length === 0)
        throw new Error("PostProcessingSolver: composite grid has no endpoint connection candidates")
      for (const { nodeId } of nearest) this.connect(sourceId, nodeId)
    }
    connectToNearest(endpointId, 8)

    for (const direction of DIRECTIONS) {
      const spoke = {
        x: endpoint.x + direction.x * this.input.grid.innerGridStep,
        y: endpoint.y + direction.y * this.input.grid.innerGridStep,
      }
      if (
        spoke.x < this.input.bounds.minX || spoke.x > this.input.bounds.maxX ||
        spoke.y < this.input.bounds.minY || spoke.y > this.input.bounds.maxY
      ) continue
      const spokeId = this.addNode(spoke)
      this.connect(endpointId, spokeId)
      connectToNearest(spokeId, 4)
    }
  }

  private addNode(point: PlanarPoint): number {
    const key = this.keyFor(point)
    const existing = this.nodeIdByPoint.get(key)
    if (existing !== undefined) return existing
    const id = this.nodes.length
    this.nodes.push({ point: { x: point.x, y: point.y }, neighborIds: new Set() })
    this.nodeIdByPoint.set(key, id)
    return id
  }

  private connect(firstId: number, secondId: number): void {
    if (firstId === secondId) return
    const first = this.nodes[firstId]!
    const second = this.nodes[secondId]!
    first.neighborIds.add(secondId)
    second.neighborIds.add(firstId)
  }

  private keyFor(point: PlanarPoint): string {
    const x = Object.is(point.x, -0) ? 0 : point.x
    const y = Object.is(point.y, -0) ? 0 : point.y
    return `${x.toFixed(12)}:${y.toFixed(12)}`
  }

  private exactKeyFor(point: PlanarPoint): string {
    const x = Object.is(point.x, -0) ? 0 : point.x
    const y = Object.is(point.y, -0) ? 0 : point.y
    return `${x}:${y}`
  }
}
