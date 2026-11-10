import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../../lib"

test("brings adjoining pair sections into a wide middle station from opposite sides", () => {
  const members = ["P", "N"]
  const hdRoutes = members.flatMap((rootConnectionName, polarity) =>
    [0, 1].map(
      (section): HighDensityRoute => ({
        connectionName: `${rootConnectionName}${section}`,
        rootConnectionName,
        traceThickness: 0.15,
        viaDiameter: 0.3,
        vias: [],
        route: [-6 + section * 6, section * 6].map((x) => ({
          x,
          y: polarity * 2.54,
          z: 0,
        })),
      }),
    ),
  )
  const solver = new PostProcessingSolver({
    hdRoutes,
    differentialPairs: [0, 1].map((section) => ({
      connectionNames: [`P${section}`, `N${section}`],
      lengthTolerance: 0.05,
    })),
    obstacles: members.flatMap((rootConnectionName, polarity) =>
      [-6, 0, 6].map((x) => ({
        type: "rect",
        layers: ["top"],
        center: { x, y: polarity * 2.54 },
        width: 1.5,
        height: 1.5,
        connectedTo: [rootConnectionName],
      })),
    ),
    bounds: { minX: -8, maxX: 8, minY: -3, maxY: 5 },
    layerCount: 2,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.postProcessingErrors).toEqual([])
  for (const { route } of output.hdRoutes) {
    const startsAtMiddle = Math.abs(route[0]!.x) < 1e-8
    const middleLead = startsAtMiddle ? route[1]! : route.at(-2)!
    const outerPad = startsAtMiddle ? route.at(-1)! : route[0]!
    expect(middleLead.x * outerPad.x).toBeGreaterThan(1e-6)
  }
  expect(solver.finalVisualize()).toMatchGraphicsSvg(import.meta.path)
})
