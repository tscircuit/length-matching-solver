import type { LengthMatchingSolverParams } from "../../lib"

export const crossLayerCenterlineCrash: LengthMatchingSolverParams = {
  hdRoutes: [
    {
      connectionName: "CAM_CLK_P",
      traceThickness: 0.15,
      viaDiameter: 0.6,
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 12, y: 0, z: 0 },
        { x: 12, y: 0, z: 1 },
        { x: 24, y: 0, z: 1 },
      ],
      vias: [{ x: 12, y: 0, zLayers: [0, 1] }],
    },
    {
      connectionName: "CAM_CLK_N",
      traceThickness: 0.15,
      viaDiameter: 0.6,
      route: [
        { x: 0, y: 2, z: 1 },
        { x: 27, y: 2, z: 1 },
      ],
      vias: [],
    },
  ],
  originalConnections: [
    {
      name: "CAM_CLK_P",
      pointsToConnect: [
        { x: 0, y: 0, layer: "top" },
        { x: 24, y: 0, layer: "bottom" },
      ],
    },
    {
      name: "CAM_CLK_N",
      pointsToConnect: [
        { x: 0, y: 2, layer: "bottom" },
        { x: 27, y: 2, layer: "bottom" },
      ],
    },
  ],
  differentialPairs: [
    {
      connectionNames: ["CAM_CLK_P", "CAM_CLK_N"],
      lengthTolerance: 0.01,
      minimumCenterlineDistance: 0.15,
      maximumCenterlineDistance: 0.5,
    },
  ],
  maximumMeanderDepth: 3,
  minimumToothPitch: 1,
  maxToothCount: 8,
  bounds: { minX: -1, maxX: 28, minY: -4, maxY: 5 },
  obstacles: [],
  obstacleMargin: 0.15,
  layerCount: 2,
}
