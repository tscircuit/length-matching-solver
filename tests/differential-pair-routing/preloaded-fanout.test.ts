import { expect, test } from "bun:test"
import { DifferentialPairRoutingSolver } from "../../lib/DifferentialPairRoutingSolver"
import type { DifferentialPairRoutingSrj } from "../../lib/differential-pair-routing/types"
import type { SimplifiedPcbTrace } from "../../lib/types"

test("routes between fixed fanout traces with the same connection names", (): void => {
  const srj: DifferentialPairRoutingSrj = {
    layerCount: 2,
    minTraceWidth: 0.1,
    bounds: { minX: -2, maxX: 22, minY: -5, maxY: 5 },
    obstacles: [],
    differentialPairs: [{
      connectionNames: ["P", "N"],
      lengthTolerance: 0.1,
      traceGap: 0.3,
      maxUncoupledLength: 2,
    }],
    connections: ["P", "N"].map((name, index) => ({
      name,
      pointsToConnect: [
        { x: 2, y: index * 0.4, layer: "top" },
        { x: 18, y: index * 0.4, layer: "top" },
      ],
    })),
    traces: ["P", "N"].flatMap((name, index) =>
      [[0, 2], [18, 20]].map(([start, end], side): SimplifiedPcbTrace => ({
        type: "pcb_trace",
        pcb_trace_id: `fanout_${name}_${side}`,
        connection_name: name,
        route: [
          { route_type: "wire", x: start!, y: index * 0.4, layer: "top", width: 0.1 },
          { route_type: "wire", x: end!, y: index * 0.4, layer: "top", width: 0.1 },
        ],
      })),
    ),
  }
  const original = structuredClone(srj)
  const solver = new DifferentialPairRoutingSolver(srj)
  solver.solve()
  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  expect(srj).toEqual(original)
  expect(output.srj.traces!.slice(0, 4)).toEqual(original.traces!)
  expect(output.routedTraces).toHaveLength(2)
  expect(output.srj.connections).toHaveLength(0)
  expect(solver.lengthMatchingSolver!.getOutput().matchedHdRoutes).toHaveLength(2)
  for (const trace of output.routedTraces) {
    expect(trace.route[0]).toMatchObject({ x: 2, layer: "top" })
    expect(trace.route.at(-1)).toMatchObject({ x: 18, layer: "top" })
  }
})
