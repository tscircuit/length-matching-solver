import { expect, test } from "bun:test"
import { LengthMatchingSolver } from "../lib/length-matching-solver"
import { findConnectionRouteIndexes } from "../lib/length-matching/connection/findConnectionRouteIndexes"
import type { HighDensityRoute } from "../lib/types"

test.failing(
  "ordered lanes select exact hops without their same-root tap",
  (): void => {
    const routes: HighDensityRoute[] = [
      "P_BC",
      "tap",
      "N_AB",
      "P_AB",
      "N_BC",
    ].map((connectionName, index) => ({
      connectionName,
      rootConnectionName: connectionName.startsWith("N") ? "N" : "P",
      traceThickness: 0.15,
      viaDiameter: 0.6,
      route: [
        { x: 0, y: index, z: 0 },
        { x: 1, y: index, z: 0 },
      ],
      vias: [],
    }))
    // Strings retain the existing root-based lookup used by buses.
    expect(findConnectionRouteIndexes(routes, "P")).toEqual([0, 1, 3])
    // @ts-expect-error Reproduction: main cannot carry an ordered lane.
    expect(findConnectionRouteIndexes(routes, ["P_AB", "P_BC"])).toEqual([3, 0])
    const solver = new LengthMatchingSolver({
      hdRoutes: routes,
      originalConnections: routes.map((route) => ({
        name: route.connectionName,
        pointsToConnect: [
          { x: 0, y: 0, layer: "top" },
          { x: 1, y: 0, layer: "top" },
        ],
      })),
      differentialPairs: [
        {
          connectionNames: [
            // @ts-expect-error Reproduction: main only accepts one string per lane.
            ["P_AB", "P_BC"],
            // @ts-expect-error Reproduction: main only accepts one string per lane.
            ["N_AB", "N_BC"],
          ],
          lengthTolerance: 0.1,
        },
      ],
    })
    solver.step()
    expect(solver.failed).toBe(false)
    expect<unknown>(
      solver.getConstructorParams()[0].differentialPairs![0]!.connectionNames,
    ).toEqual([
      ["P_AB", "P_BC"],
      ["N_AB", "N_BC"],
    ])
  },
)
