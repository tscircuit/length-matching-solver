import { expect, test } from "bun:test"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../../lib"

test("uses the compact pitch when obstacles reject relaxed alternatives", () => {
  const params: LengthMatchingSolverParams = {
    hdRoutes: [
      {
        connectionName: "long-route",
        traceThickness: 0.15,
        viaDiameter: 0.6,
        vias: [],
        route: [
          { x: 0, y: 5, z: 0 },
          { x: 0, y: 6.5, z: 0 },
          { x: 10, y: 6.5, z: 0 },
          { x: 10, y: 5, z: 0 },
        ],
      },
      {
        connectionName: "short-route",
        traceThickness: 0.15,
        viaDiameter: 0.6,
        vias: [],
        route: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
      },
    ],
    originalConnections: [
      {
        name: "long-route",
        pointsToConnect: [
          { x: 0, y: 5, layer: "top" },
          { x: 10, y: 5, layer: "top" },
        ],
      },
      {
        name: "short-route",
        pointsToConnect: [
          { x: 0, y: 0, layer: "top" },
          { x: 10, y: 0, layer: "top" },
        ],
      },
    ],
    differentialPairs: [
      {
        connectionNames: ["long-route", "short-route"],
        lengthTolerance: 0.01,
      },
    ],
    maximumMeanderDepth: 3,
    maxToothCount: 1,
    bounds: { minX: -1, maxX: 11, minY: -4, maxY: 8 },
    obstacles: [-1, 1].map((normalSign, obstacleIndex) => ({
      obstacleId: `relaxed-pitch-blocker-${obstacleIndex}`,
      type: "rect" as const,
      layers: ["top"],
      connectedTo: [],
      center: { x: 4, y: normalSign * 1.65 },
      width: 0.8,
      height: 1.7,
    })),
    obstacleMargin: 0.15,
    layerCount: 2,
  }
  const solver = new LengthMatchingSolver(params)

  solver.solve()

  const tunedRoute = solver.matchedHdRoutes[1]?.route
  if (!tunedRoute) throw new Error("Expected the compact tuned route")
  const deepTuningPoints = tunedRoute.filter((point) => point.y < -1.5)
  const deepTuningSpan =
    Math.max(...deepTuningPoints.map((point) => point.x)) -
    Math.min(...deepTuningPoints.map((point) => point.x))
  expect(solver.solved).toBe(true)
  expect(deepTuningSpan).toBeCloseTo(0.45)
})
