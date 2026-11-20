import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"
import { getRouteLength } from "../../../lib/route-geometry"

test("escapes staggered CAM terminals within the requested pair gap range", () => {
  const terminals = [
    { connectionName: "CAM_N", y: -0.3, startX: -14, endX: 9, padHeight: 0.25 },
    { connectionName: "CAM_P", y: 0.3, startX: -14, endX: 14, padHeight: 0.25 },
    {
      connectionName: "AUX",
      y: 6,
      startX: -7.175,
      endX: 7.175,
      padHeight: 0.95,
    },
  ]
  const fixture: PostProcessingSolverParams = {
    hdRoutes: terminals.map(({ connectionName, y, startX, endX }) => ({
      connectionName,
      traceThickness: 0.15,
      viaDiameter: 0.3,
      route: [startX, endX].map((x) => ({ x, y, z: 0 })),
      vias: [],
    })),
    obstacles: terminals.flatMap(
      ({ connectionName, y, startX, endX, padHeight }) =>
        [startX, endX].map((x) => ({
          type: "rect",
          center: { x, y },
          width: 0.8,
          height: padHeight,
          layers: ["top"],
          connectedTo: [connectionName],
        })),
    ),
    differentialPairs: [
      {
        connectionNames: ["CAM_P", "CAM_N"],
        lengthTolerance: 0.05,
        minimumCenterlineDistance: 0.39,
        maximumCenterlineDistance: 0.41,
      },
    ],
    bounds: { minX: -22.5, maxX: 22.5, minY: -12, maxY: 12 },
    layerCount: 4,
    minTraceToPadEdgeClearance: 0.1,
  }
  const solver = new PostProcessingSolver(fixture)
  solver.solve()
  expect(solver.solved).toBe(true)

  const { hdRoutes, postProcessingErrors } = solver.getOutput()
  expect(postProcessingErrors).toEqual([])
  expect(hdRoutes.map(({ connectionName }) => connectionName)).toEqual(
    fixture.hdRoutes.map(({ connectionName }) => connectionName),
  )

  const [negative, positive, aux] = hdRoutes
  if (!negative || !positive || !aux) {
    throw new Error("CAM board routes missing")
  }
  expect(aux).toEqual(fixture.hdRoutes[2])
  for (const [index, routed] of hdRoutes.entries()) {
    const original = fixture.hdRoutes[index]!
    expect(routed.route[0]).toMatchObject(original.route[0]!)
    expect(routed.route.at(-1)).toMatchObject(original.route.at(-1)!)
  }

  const pair = fixture.differentialPairs[0]!
  expect(
    Math.abs(getRouteLength(positive) - getRouteLength(negative)),
  ).toBeLessThanOrEqual(pair.lengthTolerance)

  // Sample across a straight coupled run before the length-tuning bends.
  const tracks = [positive, negative].map(({ route, traceThickness }) => {
    const track = route.find((point, index) => {
      const next = route[index + 1]
      return (
        next &&
        point.x <= -10 &&
        next.x >= -10 &&
        point.z === next.z &&
        Math.abs(point.y - next.y) < 1e-8
      )
    })
    if (!track) throw new Error("No straight copper at the CAM cross-section")
    return { ...track, traceThickness }
  })
  const [first, second] = tracks
  expect(first!.z).toBe(second!.z)
  const centerlineSpacing = Math.abs(first!.y - second!.y)
  const copperGap =
    centerlineSpacing - (first!.traceThickness + second!.traceThickness) / 2
  expect(copperGap).toBeGreaterThanOrEqual(0.24 - 1e-8)
  expect(copperGap).toBeLessThanOrEqual(0.26 + 1e-8)
})
