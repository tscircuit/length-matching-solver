import { getLayerIndex } from "../geometry/getLayerIndex"
import { getLayerName } from "../geometry/getLayerName"
import type { CoupledPathPoint, CoupledPathSearchInput } from "./types"

type SearchNode = {
  point: CoupledPathPoint
  direction: number
  cost: number
  estimate: number
  parent: SearchNode | null
}

const DIRECTIONS = [
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
  { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
]

/** Advances the common-spine A* search one explored node at a time. */
export class IncrementalCoupledPathSearch {
  private readonly queue: SearchNode[]
  private readonly bestCosts = new Map<string, number>()
  private readonly startLayer: number
  private readonly endLayer: number
  private current: SearchNode | null = null
  private result: CoupledPathPoint[] | null = null
  private status: "searching" | "found" | "exhausted" = "searching"
  private explored = 0

  constructor(private readonly input: CoupledPathSearchInput) {
    this.startLayer = getLayerIndex(input.start.layer, input.layerCount)
    this.endLayer = getLayerIndex(input.end.layer, input.layerCount)
    if (this.startLayer < 0 || this.endLayer < 0) {
      this.queue = []
      this.status = "exhausted"
      return
    }
    const start: SearchNode = {
      point: input.start,
      direction: -1,
      cost: 0,
      estimate: this.estimate(input.start),
      parent: null,
    }
    this.queue = [start]
    this.bestCosts.set(this.keyFor(input.start, -1), 0)
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

  step(): void {
    if (this.status !== "searching") return
    this.queue.sort((left, right) =>
      left.estimate - right.estimate || left.cost - right.cost ||
      left.point.x - right.point.x || left.point.y - right.point.y ||
      left.point.layer.localeCompare(right.point.layer),
    )
    const current = this.queue.shift()
    if (!current) {
      this.status = "exhausted"
      return
    }
    this.current = current
    this.explored++
    const distanceToEnd = Math.hypot(
      current.point.x - this.input.end.x,
      current.point.y - this.input.end.y,
    )
    if (
      current.point.layer === this.input.end.layer &&
      distanceToEnd <= this.input.gridStep * 1.5 &&
      this.input.isEdgeValid(current.point, this.input.end)
    ) {
      this.result = this.simplifyPath([...this.createPath(current), this.input.end])
      this.status = "found"
      return
    }
    this.enqueuePlanarNeighbors(current)
    this.enqueueViaNeighbors(current)
    if (this.explored >= 75_000)
      throw new Error(
        "PostProcessingSolver: coupled path search exhausted its 75000-state invariant limit",
      )
    if (this.queue.length === 0) this.status = "exhausted"
  }

  private estimate(point: CoupledPathPoint): number {
    return Math.hypot(point.x - this.input.end.x, point.y - this.input.end.y) +
      Math.abs(getLayerIndex(point.layer, this.input.layerCount) - this.endLayer) * 3
  }

  private keyFor(point: CoupledPathPoint, direction: number): string {
    return `${point.x.toFixed(5)}:${point.y.toFixed(5)}:${point.layer}:${direction}`
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
      return (point.x - previous.x) * (next.y - point.y) !==
          (point.y - previous.y) * (next.x - point.x) ||
        point.layer !== previous.layer || point.layer !== next.layer
    })
  }

  private enqueuePlanarNeighbors(current: SearchNode): void {
    for (let direction = 0; direction < DIRECTIONS.length; direction++) {
      const delta = DIRECTIONS[direction]!
      const next: CoupledPathPoint = {
        x: Math.round((current.point.x + delta.x * this.input.gridStep) * 1e6) / 1e6,
        y: Math.round((current.point.y + delta.y * this.input.gridStep) * 1e6) / 1e6,
        layer: current.point.layer,
      }
      if (
        next.x < this.input.bounds.minX || next.x > this.input.bounds.maxX ||
        next.y < this.input.bounds.minY || next.y > this.input.bounds.maxY ||
        !this.input.isEdgeValid(current.point, next)
      ) continue
      const bendCost = current.direction < 0 || current.direction === direction ? 0 : 0.18
      const cost = current.cost + Math.hypot(delta.x, delta.y) * this.input.gridStep + bendCost
      const key = this.keyFor(next, direction)
      if ((this.bestCosts.get(key) ?? Number.POSITIVE_INFINITY) <= cost) continue
      this.bestCosts.set(key, cost)
      this.queue.push({ point: next, direction, cost, estimate: cost + this.estimate(next), parent: current })
    }
  }

  private enqueueViaNeighbors(current: SearchNode): void {
    if (current.direction < 0) return
    const currentLayer = getLayerIndex(current.point.layer, this.input.layerCount)
    for (const nextLayerIndex of [currentLayer - 1, currentLayer + 1]) {
      if (nextLayerIndex < 0 || nextLayerIndex >= this.input.layerCount) continue
      const nextLayer = getLayerName(nextLayerIndex, this.input.layerCount)
      const viaDirection = DIRECTIONS[current.direction]!
      if (!this.input.isViaValid(current.point, nextLayer, viaDirection)) continue
      const next = { ...current.point, layer: nextLayer }
      const cost = current.cost + 4
      const key = this.keyFor(next, current.direction)
      if ((this.bestCosts.get(key) ?? Number.POSITIVE_INFINITY) <= cost) continue
      this.bestCosts.set(key, cost)
      this.queue.push({ point: next, direction: current.direction, cost, estimate: cost + this.estimate(next), parent: current })
    }
  }
}
