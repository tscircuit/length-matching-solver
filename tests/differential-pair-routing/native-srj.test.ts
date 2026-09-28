import { expect, test } from "bun:test"
import {
  DifferentialPairRoutingSolver,
  type DifferentialPairRoutingSrj,
} from "../../lib"

test("routes pairs sequentially while preserving native SRJ and fixed copper", () => {
  const srj: DifferentialPairRoutingSrj & { boardName: string } = {
    boardName: "paired board",
    bounds: { minX: -2, maxX: 12, minY: -3, maxY: 9 },
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [{
      type: "rect",
      layers: ["top"],
      center: { x: 0, y: 0 },
      width: 0.4,
      height: 0.4,
      connectedTo: ["start_0"],
    }],
    connections: [0, 1, 2, 3, 4].map((index) => ({
      name: `net_${index}`,
      pointsToConnect: [
        { x: 0, y: index * 1.2, layer: "top", pcb_port_id: `start_${index}` },
        { x: 10, y: index * 1.2, layer: "top", pcb_port_id: `end_${index}` },
      ],
    })),
    differentialPairs: [
      { connectionNames: ["net_0", "net_1"], lengthTolerance: 0.01 },
      { connectionNames: ["net_2", "net_3"], lengthTolerance: 0.01 },
    ],
    traces: [{
      type: "pcb_trace",
      pcb_trace_id: "differential_pair_net_0",
      connection_name: "fixed",
      route: [
        { route_type: "wire", x: 0, y: 7, layer: "top", width: 0.15 },
        { route_type: "wire", x: 10, y: 7, layer: "top", width: 0.15 },
      ],
    }],
  }
  const original = structuredClone(srj)
  const solver = new DifferentialPairRoutingSolver(srj)
  solver.solve()
  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  expect(output.srj.boardName).toBe("paired board")
  expect(output.srj.connections.map((connection) => connection.name)).toEqual(["net_4"])
  expect(output.srj.differentialPairs).toEqual([])
  expect(output.srj.traces![0]).toEqual(original.traces![0])
  expect(output.routedTraces).toHaveLength(4)
  expect(new Set(output.srj.traces!.map((trace) => trace.pcb_trace_id)).size).toBe(5)
  expect(output.routedTraces[0]!.connectsTo).toContain("start_0")
  expect(srj).toEqual(original)
})
