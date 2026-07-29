import { test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../../lib"
import { createPostProcessingTestParams } from "../createPostProcessingTestParams"

test("routes out of obstacles connected to the active pair terminals", () => {
  const makeRoute = (connectionName: string, y: number): HighDensityRoute => ({
    connectionName,
    traceThickness: 0.2,
    viaDiameter: 0.2,
    route: [
      { x: 0, y, z: 0 },
      { x: 10, y, z: 0 },
    ],
    vias: [],
  })
  const hdRoutes = [makeRoute("P", 0.475), makeRoute("N", -0.475)]
  const obstacles = hdRoutes.flatMap((hdRoute) =>
    [0, 10].map((x) => ({
      type: "rect" as const,
      layers: ["top"],
      center: { x, y: hdRoute.route[0]!.y },
      width: 0.6,
      height: 0.6,
      connectedTo: [hdRoute.connectionName],
    })),
  )
  const { simpleRouteJson: _fixture, ...params } =
    createPostProcessingTestParams()
  const solver = new PostProcessingSolver({ ...params, hdRoutes, obstacles })
  solver.solve()
})
