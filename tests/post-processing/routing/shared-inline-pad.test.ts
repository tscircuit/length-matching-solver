import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../../lib"

test("couples both sections where they meet copper of the same net", () => {
  const hdRoutes = ["P", "N"].flatMap((rootConnectionName, polarity) =>
    [0, 1].map(
      (section): HighDensityRoute => ({
        connectionName: `${rootConnectionName}${section}`,
        rootConnectionName,
        traceThickness: 0.15,
        viaDiameter: 0.3,
        vias: [],
        route: [section * 4, (section + 1) * 4].map((x) => ({
          x,
          y: polarity * 0.4,
          z: 0,
        })),
      }),
    ),
  )
  const solver = new PostProcessingSolver({
    hdRoutes,
    differentialPairs: [0, 1].map((section) => ({
      connectionNames: [`P${section}`, `N${section}`],
      lengthTolerance: 0.025,
      minimumCenterlineDistance: 0.4,
      maximumCenterlineDistance: 0.4,
    })),
    obstacles: [],
    bounds: { minX: -1, maxX: 9, minY: -1, maxY: 2 },
    layerCount: 2,
  })
  solver.solve()

  expect(solver.getOutput().postProcessingErrors).toEqual([])
  expect(solver.stats.acceptedPairCount).toBe(2)
})
