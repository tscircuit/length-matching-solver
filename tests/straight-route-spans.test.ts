import { expect, test } from "bun:test"
import { getTunableStraightRouteSpans } from "../lib/length-matching/straight-route-spans"
import type { HighDensityRoute, RoutePoint } from "../lib"

const makeRoute = (points: RoutePoint[]): HighDensityRoute => ({
  connectionName: "test",
  traceThickness: 0.15,
  viaDiameter: 0.6,
  route: points,
  vias: [],
})

test("partitions tunable spans at geometry and semantic boundaries", (): void => {
  const cases = [
    {
      name: "explicit false jumper metadata remains tunable",
      route: makeRoute([
        { x: 0, y: 0, z: 0, insideJumperPad: false },
        { x: 1, y: 0, z: 0, insideJumperPad: false },
        { x: 2, y: 0, z: 0 },
      ]),
      spans: [[0, 2]],
    },
    {
      name: "jumper metadata protects both adjacent edges",
      route: makeRoute([
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0, insideJumperPad: true },
        { x: 2, y: 0, z: 0 },
      ]),
      spans: [],
    },
    {
      name: "through obstacle metadata protects its outgoing edge",
      route: makeRoute([
        { x: 0, y: 0, z: 0, toNextSegmentType: "through_obstacle" },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ]),
      spans: [[1, 2]],
    },
    {
      name: "direction and layer changes split spans",
      route: makeRoute([
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 1, y: 1, z: 1 },
        { x: 2, y: 1, z: 1 },
      ]),
      spans: [
        [0, 1],
        [1, 2],
        [3, 4],
      ],
    },
    {
      name: "zero-length points are absorbed",
      route: makeRoute([
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ]),
      spans: [[0, 2]],
    },
  ]

  for (const testCase of cases) {
    expect(
      getTunableStraightRouteSpans(testCase.route).map((span) => [
        span.startIndex,
        span.endIndex,
      ]),
    ).toEqual(testCase.spans)
  }
})
