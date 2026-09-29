import type { Point } from "../model/internal-types"

type PairTerminals = {
  firstStart: Point
  firstEnd: Point
  secondStart: Point
  secondEnd: Point
}

export function shouldReversePairTerminals(terminals: PairTerminals): boolean {
  const { firstStart, firstEnd, secondStart, secondEnd } = terminals
  const normalDistance =
    Math.hypot(firstStart.x - secondStart.x, firstStart.y - secondStart.y) +
    Math.hypot(firstEnd.x - secondEnd.x, firstEnd.y - secondEnd.y)
  const reversedDistance =
    Math.hypot(firstStart.x - secondEnd.x, firstStart.y - secondEnd.y) +
    Math.hypot(firstEnd.x - secondStart.x, firstEnd.y - secondStart.y)
  return reversedDistance + 1e-8 < normalDistance
}
