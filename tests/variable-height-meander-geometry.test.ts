import { expect, test } from "bun:test"
import { replaceSegmentWithMeander } from "../lib/length-matching/meander-candidate"
import type { HighDensityRoute } from "../lib/types"

test("constructs each meander tooth with its assigned height", () => {
  const route: HighDensityRoute = {
    connectionName: "short-route",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    vias: [],
    route: [
      { x: 0, y: 0, z: 0, traceThickness: 0.15 },
      { x: 6, y: 0, z: 0, traceThickness: 0.15 },
    ],
  }

  const replacedRoute = replaceSegmentWithMeander({
    route,
    segmentIndex: 0,
    toothCount: 2,
    toothPitch: 1,
    toothDepths: [1, 0],
    placement: "balanced",
  })

  expect(replacedRoute.map(({ x, y }) => [x, y])).toEqual([
    [0, 0],
    [2, 0],
    [2, -1],
    [2.5, -1],
    [2.5, 0],
    [6, 0],
  ])
  expect(replacedRoute.every((point) => point.z === 0)).toBe(true)
  expect(
    replacedRoute.every((point) => point.traceThickness === 0.15),
  ).toBe(true)
})
