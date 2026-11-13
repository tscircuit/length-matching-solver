import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../../lib"

test("reports an infeasible zero escape limit for a facing pair", (): void => {
  const hdRoutes: HighDensityRoute[] = [-0.5, 0.5].map(
    (y): HighDensityRoute => ({
      connectionName: y > 0 ? "P" : "N",
      traceThickness: 0.15,
      viaDiameter: 0.3,
      vias: [],
      route: [-5, 5].map((x) => ({ x, y, z: 0 })),
    }),
  )
  const solver = new PostProcessingSolver({
    hdRoutes,
    differentialPairs: [
      {
        connectionNames: ["P", "N"],
        lengthTolerance: 0.1,
        minimumCenterlineDistance: 0.45,
        maximumCenterlineDistance: 0.45,
        maxUncoupledLength: 0,
      },
    ],
    obstacles: [],
    bounds: { minX: -10, maxX: 10, minY: -2, maxY: 2 },
    layerCount: 2,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  expect(output.hdRoutes).toEqual(hdRoutes)
  expect(output.postProcessingErrors).toHaveLength(1)
  expect(output.postProcessingErrors[0]).toMatchObject({
    stage: "differentialPairReroutingSolver",
    connectionNames: ["P", "N"],
    reason: "no-valid-candidate",
  })
})
