import { expect, test } from "bun:test"
import { DifferentialPairRoutingSolver } from "../../lib"

test("emits each straight-pair terminal once with its port metadata", () => {
  const solver = new DifferentialPairRoutingSolver({
    bounds: { minX: -1, maxX: 11, minY: -4, maxY: 1 },
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [],
    connections: [0, 1].map((index) => ({
      name: `pair_${index}`,
      pointsToConnect: [
        {
          x: 0,
          y: -2 - index * 0.5,
          layer: "top",
          pcb_port_id: `start_${index}`,
        },
        {
          x: 10,
          y: -2 - index * 0.5,
          layer: "top",
          pcb_port_id: `end_${index}`,
        },
      ],
    })),
    differentialPairs: [
      {
        connectionNames: ["pair_0", "pair_1"],
        lengthTolerance: 0.05,
        traceGap: 0.35,
      },
    ],
  })
  solver.solve()
  const traces = solver.getOutput().routedTraces
  expect(traces).toHaveLength(2)
  for (const [index, trace] of traces.entries()) {
    expect(trace.route).toHaveLength(2)
    expect(trace.route[0]).toMatchObject({
      x: 0,
      y: -2 - index * 0.5,
      start_pcb_port_id: `start_${index}`,
    })
    expect(trace.route[1]).toMatchObject({
      x: 10,
      y: -2 - index * 0.5,
      end_pcb_port_id: `end_${index}`,
    })
  }
})
