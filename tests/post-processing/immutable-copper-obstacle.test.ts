import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"
import { getMinimumSegmentDistance } from "../../lib/route-geometry"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("detours with explicit clearance from immutable unrelated copper", () => {
  const blocker: HighDensityRoute = {
    connectionName: "OTHER",
    traceThickness: 0.2,
    viaDiameter: 0.2,
    route: [
      { x: 7.5, y: -3.5, z: 0 },
      { x: 7.5, y: 3.5, z: 0 },
    ],
    vias: [],
  }
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver({
    ...params,
    hdRoutes: [...params.hdRoutes, blocker],
    obstacles: [
      {
        type: "rect",
        layers: ["top", "bottom"],
        center: { x: 4, y: 0 },
        width: 1.5,
        height: 3,
        connectedTo: [],
      },
    ],
  })
  solver.solve()
  const { hdRoutes } = solver.getOutput()
  expect(hdRoutes[2]).toEqual(blocker)
  for (const hdRoute of hdRoutes.slice(0, 2)) {
    for (let index = 0; index < hdRoute.route.length - 1; index++) {
      const start = hdRoute.route[index]
      const end = hdRoute.route[index + 1]
      if (!start || !end || start.z !== 0 || end.z !== 0) continue
      expect(
        getMinimumSegmentDistance(
          start,
          end,
          blocker.route[0]!,
          blocker.route[1]!,
        ),
      ).toBeGreaterThanOrEqual(0.4 - 1e-7)
    }
  }
})
