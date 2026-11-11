import { expect, test } from "bun:test"
import {
  type DifferentialPair,
  type HighDensityRoute,
  PostProcessingSolver,
} from "../../../lib"

test("couples both sections where they meet copper of the same net", () => {
  const hdRoutes = ["P", "N"].flatMap((rootConnectionName, polarity) =>
    [0, 1].map(
      (section): HighDensityRoute => ({
        connectionName: `${rootConnectionName}${section}`,
        rootConnectionName,
        traceThickness: 0.15,
        viaDiameter: 0.3,
        vias: [],
        route: (polarity === 0
          ? [section, section + 1]
          : [section + 1, section]
        ).map((pad) => ({
          x: pad * 4,
          y: polarity * 0.4,
          z: 0,
          pcb_port_id: `${rootConnectionName}${pad}_port`,
        })),
      }),
    ),
  )
  const solver = new PostProcessingSolver({
    hdRoutes,
    differentialPairs: [0, 1].map((section): DifferentialPair => {
      const terminals = (
        pad: number,
      ): NonNullable<DifferentialPair["terminalPairs"]>[number] => [
        { x: pad * 4, y: 0, connectedTo: pad === 1 ? [`P${1 - section}`] : [] },
        {
          x: pad * 4,
          y: 0.4,
          connectedTo: pad === 1 ? [`N${1 - section}`] : [],
        },
      ]
      return {
        connectionNames: [`P${section}`, `N${section}`],
        terminalPairs: [terminals(section), terminals(section + 1)],
        lengthTolerance: 0.025,
        minimumCenterlineDistance: 0.4,
        maximumCenterlineDistance: 0.4,
      }
    }),
    obstacles: [],
    bounds: { minX: -1, maxX: 9, minY: -1, maxY: 2 },
    layerCount: 2,
  })
  solver.solve()

  expect(solver.getOutput().postProcessingErrors).toEqual([])
  expect(solver.stats.acceptedPairCount).toBe(2)
})
