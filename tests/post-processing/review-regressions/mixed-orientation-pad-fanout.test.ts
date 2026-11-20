import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"
import { getRouteLength } from "../../../lib/route-geometry"
import capturedFixture from "../fixtures/cam-staggered-pads.json"

test("escapes staggered CAM terminals at the requested pair gap", () => {
  // Capture from Pipeline 9 after route cleanup, before pair post-processing.
  const fixture = capturedFixture as unknown as PostProcessingSolverParams
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
  expect(centerlineSpacing).toBeCloseTo(pair.minimumCenterlineDistance!, 8)
  expect(
    centerlineSpacing - (first!.traceThickness + second!.traceThickness) / 2,
  ).toBeCloseTo(0.25, 8)
})
