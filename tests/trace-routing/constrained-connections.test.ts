import { expect, test } from "bun:test"
import { TraceRoutingSolver, type Obstacle } from "../../lib"
import { getMinimumSegmentDistance } from "../../lib/route-geometry"

test("routes constrained connections around fixed copper and joins same-net copper", (): void => {
  const pads: Obstacle[] = [
    { x: 0, y: 0, id: "a_0" },
    { x: 10, y: 0, id: "a_1" },
    { x: 0, y: 3, id: "b_0" },
    { x: 12, y: 3, id: "b_1" },
  ].map(
    ({ x, y, id }): Obstacle => ({
      type: "rect",
      layers: ["top"],
      center: { x, y },
      width: 0.2,
      height: 0.2,
      connectedTo: [id],
    }),
  )
  const wall: Obstacle = {
    type: "rect",
    layers: ["top"],
    center: { x: 5, y: 0 },
    width: 0.4,
    height: 2.4,
    connectedTo: [],
  }
  const solver = new TraceRoutingSolver({
    connections: [
      {
        connectionName: "a",
        rootConnectionName: "a",
        connectedTo: [],
        start: { x: 0, y: 0, layer: "top", pcb_port_id: "a_0" },
        end: { x: 10, y: 0, layer: "top", pcb_port_id: "a_1" },
        traceThickness: 0.15,
        viaDiameter: 0.3,
      },
      {
        connectionName: "b",
        rootConnectionName: "b",
        connectedTo: ["b_fanout"],
        start: { x: 0, y: 3, layer: "top", pcb_port_id: "b_0" },
        end: { x: 12, y: 3, layer: "top", pcb_port_id: "b_1" },
        traceThickness: 0.15,
        viaDiameter: 0.3,
      },
    ],
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "fixed",
        connection_name: "fixednet",
        route: [
          { route_type: "wire", x: 1, y: 1, width: 0.15, layer: "top" },
          { route_type: "wire", x: 9, y: 1, width: 0.15, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "b_fanout",
        connection_name: "b_fanout_net",
        route: [
          { route_type: "wire", x: 12, y: 3, width: 0.15, layer: "top" },
          { route_type: "wire", x: 13, y: 3, width: 0.15, layer: "top" },
        ],
      },
    ],
    obstacles: [...pads, wall],
    bounds: { minX: -2, maxX: 14, minY: -4, maxY: 5 },
    layerCount: 2,
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  const { hdRoutes } = solver.getOutput()
  expect(hdRoutes.map((route) => route.connectionName)).toEqual(["a", "b"])
  for (const [route, start, end] of [
    [hdRoutes[0]!, { x: 0, y: 0 }, { x: 10, y: 0 }],
    [hdRoutes[1]!, { x: 0, y: 3 }, { x: 12, y: 3 }],
  ] as const) {
    expect(route.route[0]).toMatchObject({ ...start, z: 0 })
    expect(route.route.at(-1)).toMatchObject({ ...end, z: 0 })
    expect(route.startPcbPortId).toBe(`${route.connectionName}_0`)
    expect(route.endPcbPortId).toBe(`${route.connectionName}_1`)
    for (let index = 0; index < route.route.length - 1; index++) {
      const segmentStart = route.route[index]!
      const segmentEnd = route.route[index + 1]!
      if (segmentStart.z !== 0 || segmentEnd.z !== 0) continue
      expect(
        getMinimumSegmentDistance(
          segmentStart,
          segmentEnd,
          { x: 1, y: 1 },
          { x: 9, y: 1 },
        ),
      ).toBeGreaterThanOrEqual(0.3 - 1e-7)
      expect(
        getMinimumSegmentDistance(
          segmentStart,
          segmentEnd,
          { x: 5, y: -1 },
          { x: 5, y: 1 },
        ),
      ).toBeGreaterThanOrEqual(0.2 + 0.075 - 1e-7)
    }
  }
})
