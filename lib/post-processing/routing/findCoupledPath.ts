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

/** Find a deterministic layered A* path for a common differential-pair spine. */
export const findCoupledPath = (
  input: CoupledPathSearchInput,
): CoupledPathPoint[] | null => {
  const startLayer = getLayerIndex(input.start.layer, input.layerCount)
  const endLayer = getLayerIndex(input.end.layer, input.layerCount)
  if (startLayer < 0 || endLayer < 0) return null
  const heuristic = (point: CoupledPathPoint): number =>
    Math.hypot(point.x - input.end.x, point.y - input.end.y) +
    Math.abs(getLayerIndex(point.layer, input.layerCount) - endLayer) * 3
  const keyFor = (point: CoupledPathPoint, direction: number): string =>
    `${point.x.toFixed(5)}:${point.y.toFixed(5)}:${point.layer}:${direction}`
  const queue: SearchNode[] = [{
    point: input.start,
    direction: -1,
    cost: 0,
    estimate: heuristic(input.start),
    parent: null,
  }]
  const bestCosts = new Map<string, number>()
  bestCosts.set(keyFor(input.start, -1), 0)
  let explored = 0

  while (queue.length > 0 && explored++ < 75_000) {
    queue.sort((left, right) =>
      left.estimate - right.estimate || left.cost - right.cost ||
      left.point.x - right.point.x || left.point.y - right.point.y ||
      left.point.layer.localeCompare(right.point.layer),
    )
    const current = queue.shift()!
    const distanceToEnd = Math.hypot(
      current.point.x - input.end.x,
      current.point.y - input.end.y,
    )
    if (
      current.point.layer === input.end.layer &&
      distanceToEnd <= input.gridStep * 1.5 &&
      input.isEdgeValid(current.point, input.end)
    ) {
      const path = [input.end]
      let cursor: SearchNode | null = current
      while (cursor) {
        path.push(cursor.point)
        cursor = cursor.parent
      }
      path.reverse()
      return path.filter((point, index) => {
        if (index === 0 || index === path.length - 1) return true
        const previous = path[index - 1]!
        const next = path[index + 1]!
        return (point.x - previous.x) * (next.y - point.y) !==
          (point.y - previous.y) * (next.x - point.x) ||
          point.layer !== previous.layer || point.layer !== next.layer
      })
    }

    for (let direction = 0; direction < DIRECTIONS.length; direction++) {
      const delta = DIRECTIONS[direction]!
      const next = {
        x: Math.round((current.point.x + delta.x * input.gridStep) * 1e6) / 1e6,
        y: Math.round((current.point.y + delta.y * input.gridStep) * 1e6) / 1e6,
        layer: current.point.layer,
      }
      if (
        next.x < input.bounds.minX || next.x > input.bounds.maxX ||
        next.y < input.bounds.minY || next.y > input.bounds.maxY ||
        !input.isEdgeValid(current.point, next)
      ) continue
      const bendCost = current.direction < 0 || current.direction === direction ? 0 : 0.18
      const cost = current.cost + Math.hypot(delta.x, delta.y) * input.gridStep + bendCost
      const key = keyFor(next, direction)
      if ((bestCosts.get(key) ?? Number.POSITIVE_INFINITY) <= cost) continue
      bestCosts.set(key, cost)
      queue.push({ point: next, direction, cost, estimate: cost + heuristic(next), parent: current })
    }

    if (current.direction < 0) continue
    const currentLayer = getLayerIndex(current.point.layer, input.layerCount)
    for (const nextLayerIndex of [currentLayer - 1, currentLayer + 1]) {
      if (nextLayerIndex < 0 || nextLayerIndex >= input.layerCount) continue
      const nextLayer = getLayerName(nextLayerIndex, input.layerCount)
      const viaDirection = DIRECTIONS[current.direction]!
      if (!input.isViaValid(current.point, nextLayer, viaDirection)) continue
      const next = { ...current.point, layer: nextLayer }
      const cost = current.cost + 4
      const key = keyFor(next, current.direction)
      if ((bestCosts.get(key) ?? Number.POSITIVE_INFINITY) <= cost) continue
      bestCosts.set(key, cost)
      queue.push({ point: next, direction: current.direction, cost, estimate: cost + heuristic(next), parent: current })
    }
  }
  if (explored >= 75_000)
    throw new Error(
      "PostProcessingSolver: coupled path search exhausted its 75000-state invariant limit",
    )
  return null
}
