import type { HighDensityRoute, LengthMatchingSolverParams } from "../../lib"

/** Separate copper hops, including a 2mm component gap on each lane. */
export const createLaneMembershipParams = (): LengthMatchingSolverParams => {
  const hdRoutes: HighDensityRoute[] = [
    { connectionName: "P:0", rootConnectionName: "P_BEFORE", x: 0, y: 0, length: 5 },
    { connectionName: "P:1", rootConnectionName: "P_AFTER", x: 7, y: 0, length: 15 },
    { connectionName: "N:0", rootConnectionName: "N_BEFORE", x: 0, y: 4, length: 10 },
    { connectionName: "N:1", rootConnectionName: "N_AFTER", x: 12, y: 4, length: 10 },
  ].map(({ connectionName, rootConnectionName, x, y, length }): HighDensityRoute => ({
    connectionName,
    rootConnectionName,
    traceThickness: 0.15,
    viaDiameter: 0.6,
    route: [{ x, y, z: 0 }, { x: x + length, y, z: 0 }],
    vias: [],
  }))
  return {
    hdRoutes,
    originalConnections: hdRoutes.map((route) => ({
      name: route.connectionName,
      rootConnectionName: route.rootConnectionName,
      pointsToConnect: route.route.map(({ x, y }) => ({ x, y, layer: "top" })),
    })),
    // SAFETY: Deliberately exercise the decided, not-yet-implemented public
    // contract. Remove this cast when the exact-membership API lands.
    differentialPairs: [{
      connectionNames: [["P:0", "P:1"], ["N:0", "N:1"]],
      maxLengthSkewMm: 0.01,
    }] as unknown as LengthMatchingSolverParams["differentialPairs"],
    layerCount: 2,
  }
}
