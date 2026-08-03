import { expect, test } from "bun:test"
import { PostProcessingSolver } from "../../../lib"

test("routes a pair between adjacent pad rows", () => {
  const solver = new PostProcessingSolver({
    hdRoutes: [
      {
        connectionName: "source_trace_1",
        traceThickness: 0.15,
        viaDiameter: 0.3,
        route: [
          { x: -7.15, y: 0.635, z: 0 },
          { x: -6.670373223161319, y: 0.15537322316131935, z: 0 },
          { x: 2.3703732231613195, y: 0.15537322316131935, z: 0 },
          { x: 2.85, y: 0.635, z: 0 },
        ],
        vias: [],
      },
      {
        connectionName: "source_trace_0",
        traceThickness: 0.15,
        viaDiameter: 0.3,
        route: [
          { x: -7.15, y: 1.905, z: 0 },
          { x: -6.619852186173339, y: 2.4351478138266613, z: 0 },
          { x: 2.319852186173339, y: 2.4351478138266613, z: 0 },
          { x: 2.85, y: 1.905, z: 0 },
        ],
        vias: [],
      },
    ],
    differentialPairs: [
      {
        connectionNames: ["source_trace_0", "source_trace_1"],
        lengthTolerance: 0.05,
      },
    ],
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: -7.15, y: 1.905 },
        width: 1,
        height: 0.6,
        connectedTo: ["source_trace_0"],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: -7.15, y: 0.635 },
        width: 1,
        height: 0.6,
        connectedTo: ["source_trace_1"],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: -7.15, y: -0.635 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: -7.15, y: -1.905 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: -2.85, y: -1.905 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: -2.85, y: -0.635 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: -2.85, y: 0.635 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: -2.85, y: 1.905 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 2.85, y: 1.905 },
        width: 1,
        height: 0.6,
        connectedTo: ["source_trace_0"],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 2.85, y: 0.635 },
        width: 1,
        height: 0.6,
        connectedTo: ["source_trace_1"],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 2.85, y: -0.635 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 2.85, y: -1.905 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 7.15, y: -1.905 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 7.15, y: -0.635 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 7.15, y: 0.635 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 7.15, y: 1.905 },
        width: 1,
        height: 0.6,
        connectedTo: [],
      },
    ],
    bounds: { minX: -10, maxX: 10, minY: -10, maxY: 10 },
    layerCount: 2,
  })

  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  expect(solver.getOutput().hdRoutes).toHaveLength(2)
})
