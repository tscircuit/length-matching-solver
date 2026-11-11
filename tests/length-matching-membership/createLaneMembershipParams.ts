import type { HighDensityRoute, LengthMatchingSolverParams } from "../../lib"

/** Separate copper hops, including a 2mm component gap on each lane. */
export const createLaneMembershipParams = (): LengthMatchingSolverParams => {
  const hops: Array<[string, string, number, number, number]> = [
    ["P:0", "P_BEFORE", 0, 0, 5],
    ["P:1", "P_AFTER", 7, 0, 15],
    ["N:0", "N_BEFORE", 0, 4, 10],
    ["N:1", "N_AFTER", 12, 4, 10],
  ]
  const hdRoutes = hops.map(
    ([connectionName, rootConnectionName, x, y, length]): HighDensityRoute => ({
      connectionName,
      rootConnectionName,
      traceThickness: 0.15,
      viaDiameter: 0.6,
      route: [
        { x, y, z: 0 },
        { x: x + length, y, z: 0 },
      ],
      vias: [],
    }),
  )
  return {
    hdRoutes,
    originalConnections: hdRoutes.map((route) => ({
      name: route.connectionName,
      rootConnectionName: route.rootConnectionName,
      pointsToConnect: route.route.map(({ x, y }) => ({ x, y, layer: "top" })),
    })),
    differentialPairs: [
      {
        connectionNames: [
          ["P:0", "P:1"],
          ["N:0", "N:1"],
        ],
        maxLengthSkewMm: 0.01,
      },
    ],
    layerCount: 2,
  }
}
