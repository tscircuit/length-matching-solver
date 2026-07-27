import { getLayerIndex } from "../geometry/getLayerIndex"
import { getLayerName } from "../geometry/getLayerName"
import { CompositeRoutingGrid } from "./CompositeRoutingGrid"
import type { CoupledPathPoint, CoupledPathSearchInput } from "./types"

type Direction = { x: number; y: number; key: string }

type SearchNode = {
  point: CoupledPathPoint
  direction: Direction | null
  cost: number
  estimate: number
  parent: SearchNode | null
  sequence: number
}

/** Advances the common-spine composite-grid A* search one explored node at a time. */
export class IncrementalCoupledPathSearch {
  private readonly queue: SearchNode[]
  private readonly bestCosts = new Map<string, number>()
  private readonly startLayer: number
  private readonly endLayer: number
  private readonly grid: CompositeRoutingGrid
  private readonly maxSearchStates: number
  private current: SearchNode | null = null
  private result: CoupledPathPoint[] | null = null
  private status: "searching" | "found" | "exhausted" = "searching"
  private explored = 0
  private nextSequence = 1

  constructor(private readonly input: CoupledPathSearchInput) {
    this.startLayer = getLayerIndex(input.start.layer, input.layerCount)
    this.endLayer = getLayerIndex(input.end.layer, input.layerCount)
    this.grid = new CompositeRoutingGrid(input)
    this.maxSearchStates = this.grid.getSearchStateCountUpperBound(
      input.layerCount,
    )
    if (this.startLayer < 0 || this.endLayer < 0) {
      this.queue = []
      this.status = "exhausted"
      return
    }
    const start: SearchNode = {
      point: input.start,
      direction: null,
      cost: 0,
      estimate: this.estimate(input.start),
      parent: null,
      sequence: 0,
    }
    this.queue = [start]
    this.bestCosts.set(this.keyFor(input.start, null), 0)
  }

  isComplete(): boolean {
    return this.status !== "searching"
  }

  getPath(): CoupledPathPoint[] | null {
    return this.result
  }

  getPreviewPath(): CoupledPathPoint[] {
    return this.current ? this.createPath(this.current) : [this.input.start]
  }

  getExploredCount(): number {
    return this.explored
  }

  getProgress(): number {
    if (this.status !== "searching") return 1
    return Math.min(0.99, this.explored / this.maxSearchStates)
  }

  getSearchStateLimit(): number {
    return this.maxSearchStates
  }

  getGridNodeCount(): number {
    return this.grid.getNodeCount()
  }

  step(): void {
    if (this.status !== "searching") return
    this.queue.sort(
      (left, right) =>
        left.estimate - right.estimate ||
        left.cost - right.cost ||
        left.point.x - right.point.x ||
        left.point.y - right.point.y ||
        (left.point.layer < right.point.layer
          ? -1
          : left.point.layer > right.point.layer
            ? 1
            : 0) ||
        left.sequence - right.sequence,
    )
    const current = this.queue.shift()
    if (!current) {
      this.status = "exhausted"
      return
    }
    const currentBestCost = this.bestCosts.get(
      this.keyFor(current.point, current.direction),
    )
    if (currentBestCost === undefined)
      throw new Error(
        "PostProcessingSolver: coupled path queue contains an untracked state",
      )
    if (current.cost > currentBestCost + 1e-10) {
      if (this.queue.length === 0) this.status = "exhausted"
      return
    }
    this.current = current
    this.explored++
    if (this.explored > this.maxSearchStates)
      throw new Error(
        `PostProcessingSolver: coupled path search exceeded its ${this.maxSearchStates}-state graph invariant limit`,
      )
    if (this.isEnd(current.point)) {
      const path = this.createPath(current)
      path[path.length - 1] = this.input.end
      this.result = this.simplifyPath(path)
      this.status = "found"
      return
    }
    this.enqueuePlanarNeighbors(current)
    this.enqueueViaNeighbors(current)
    if (this.queue.length === 0) this.status = "exhausted"
  }

  private isEnd(point: CoupledPathPoint): boolean {
    return (
      point.layer === this.input.end.layer &&
      point.x === this.input.end.x &&
      point.y === this.input.end.y
    )
  }

  private estimate(point: CoupledPathPoint): number {
    return (
      Math.hypot(point.x - this.input.end.x, point.y - this.input.end.y) +
      Math.abs(
        getLayerIndex(point.layer, this.input.layerCount) - this.endLayer,
      ) *
        3
    )
  }

  private keyFor(point: CoupledPathPoint, direction: Direction | null): string {
    const x = Object.is(point.x, -0) ? 0 : point.x
    const y = Object.is(point.y, -0) ? 0 : point.y
    return `${x}:${y}:${point.layer}:${direction?.key ?? "start"}`
  }

  private createDirection(
    start: CoupledPathPoint,
    end: CoupledPathPoint,
  ): Direction {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    if (length <= 1e-10)
      throw new Error(
        "PostProcessingSolver: composite grid produced a zero-length planar edge",
      )
    const x = dx / length
    const y = dy / length
    return { x, y, key: `${x.toFixed(6)}:${y.toFixed(6)}` }
  }

  private createPath(node: SearchNode): CoupledPathPoint[] {
    const path: CoupledPathPoint[] = []
    let cursor: SearchNode | null = node
    while (cursor) {
      path.push(cursor.point)
      cursor = cursor.parent
    }
    return path.reverse()
  }

  private simplifyPath(path: CoupledPathPoint[]): CoupledPathPoint[] {
    return path.filter((point, index) => {
      if (index === 0 || index === path.length - 1) return true
      const previous = path[index - 1]!
      const next = path[index + 1]!
      const incoming = { x: point.x - previous.x, y: point.y - previous.y }
      const outgoing = { x: next.x - point.x, y: next.y - point.y }
      const crossProduct = incoming.x * outgoing.y - incoming.y * outgoing.x
      const lengthProduct =
        Math.hypot(incoming.x, incoming.y) * Math.hypot(outgoing.x, outgoing.y)
      return (
        Math.abs(crossProduct) > lengthProduct * 1e-10 ||
        point.layer !== previous.layer ||
        point.layer !== next.layer
      )
    })
  }

  private enqueuePlanarNeighbors(current: SearchNode): void {
    for (const next of this.grid.getPlanarNeighbors(current.point)) {
      if (!this.input.isEdgeValid(current.point, next)) continue
      const direction = this.createDirection(current.point, next)
      const bendCost =
        current.direction === null || current.direction.key === direction.key
          ? 0
          : 0.18
      const cost =
        current.cost +
        Math.hypot(next.x - current.point.x, next.y - current.point.y) +
        bendCost
      const key = this.keyFor(next, direction)
      if ((this.bestCosts.get(key) ?? Number.POSITIVE_INFINITY) <= cost)
        continue
      this.bestCosts.set(key, cost)
      this.queue.push({
        point: next,
        direction,
        cost,
        estimate: cost + this.estimate(next),
        parent: current,
        sequence: this.nextSequence++,
      })
    }
  }

  private enqueueViaNeighbors(current: SearchNode): void {
    if (!current.direction) return
    const currentLayer = getLayerIndex(
      current.point.layer,
      this.input.layerCount,
    )
    for (const nextLayerIndex of [currentLayer - 1, currentLayer + 1]) {
      if (nextLayerIndex < 0 || nextLayerIndex >= this.input.layerCount)
        continue
      const nextLayer = getLayerName(nextLayerIndex, this.input.layerCount)
      if (!this.input.isViaValid(current.point, nextLayer, current.direction))
        continue
      const next = { ...current.point, layer: nextLayer }
      const cost = current.cost + 4
      const key = this.keyFor(next, current.direction)
      if ((this.bestCosts.get(key) ?? Number.POSITIVE_INFINITY) <= cost)
        continue
      this.bestCosts.set(key, cost)
      this.queue.push({
        point: next,
        direction: current.direction,
        cost,
        estimate: cost + this.estimate(next),
        parent: current,
        sequence: this.nextSequence++,
      })
    }
  }
}
