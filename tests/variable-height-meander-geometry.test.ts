import { expect, test } from "bun:test"
import { replaceSegmentWithMeander } from "../lib/length-matching/meander-candidate"
import type { HighDensityRoute } from "../lib/types"

test("constructs each meander tooth with its assigned height and rounded turns", () => {
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

  expect(replacedRoute[0]).toMatchObject({ x: 0, y: 0 })
  expect(replacedRoute.at(-1)).toMatchObject({ x: 6, y: 0 })
  expect(Math.min(...replacedRoute.map((point) => point.y))).toBe(-1)
  expect(
    replacedRoute
      .filter((point) => point.x >= 3)
      .every((point) => point.y === 0),
  ).toBe(true)
  const segmentDirections = replacedRoute.slice(1).map((point, index) => {
    const previous = replacedRoute[index]!
    const length = Math.hypot(point.x - previous.x, point.y - previous.y)
    return {
      x: (point.x - previous.x) / length,
      y: (point.y - previous.y) / length,
    }
  })
  expect(
    segmentDirections.slice(1).every((direction, index) => {
      const previousDirection = segmentDirections[index]!
      return (
        previousDirection.x * direction.x +
          previousDirection.y * direction.y >
        0
      )
    }),
  ).toBe(true)
  expect(replacedRoute.every((point) => point.z === 0)).toBe(true)
  expect(replacedRoute.every((point) => point.traceThickness === 0.15)).toBe(
    true,
  )
})
