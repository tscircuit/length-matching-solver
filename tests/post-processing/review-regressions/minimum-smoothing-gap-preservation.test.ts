import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { getMinimumPairEdgeGap } from "../../../lib/post-processing/geometry/getMinimumPairEdgeGap"
import { parseSimplifiedPcbTrace } from "../../../lib/post-processing/model/parseSimplifiedPcbTrace"
import { FortyFiveDegreeSimplificationSolver } from "../../../lib/post-processing/solvers/FortyFiveDegreeSimplificationSolver"

test("preserves the initial pair gap when an obstacle makes smoothing asymmetric", () => {
  const createTrace = (
    connectionName: string,
    yOffset: number,
  ): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `trace_${connectionName}`,
    connection_name: connectionName,
    route: [
      { route_type: "wire", x: 0, y: 2 + yOffset, width: 0.2, layer: "top" },
      { route_type: "wire", x: 1, y: 3 + yOffset, width: 0.2, layer: "top" },
      { route_type: "wire", x: 4, y: 3 + yOffset, width: 0.2, layer: "top" },
      { route_type: "wire", x: 6, y: 4 + yOffset, width: 0.2, layer: "top" },
      { route_type: "wire", x: 8, y: 6 + yOffset, width: 0.2, layer: "top" },
    ],
  })
  const traces = [createTrace("P", 0), createTrace("N", -1)]
  const initialGap = getMinimumPairEdgeGap(
    parseSimplifiedPcbTrace(traces[0]!, 2),
    parseSimplifiedPcbTrace(traces[1]!, 2),
  )
  const solver = new FortyFiveDegreeSimplificationSolver({
    traces,
    reroutedPairs: [{ connectionNames: ["P", "N"], lengthTolerance: 0.01 }],
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 5, y: 1.65 },
        width: 0.1,
        height: 0.1,
        connectedTo: [],
      },
    ],
    bounds: { minX: -1, maxX: 9, minY: 0, maxY: 7 },
    layerCount: 2,
  })
  solver.solve()
  const output = solver.getOutput()
  const finalGap = getMinimumPairEdgeGap(
    parseSimplifiedPcbTrace(output.traces[0]!, 2),
    parseSimplifiedPcbTrace(output.traces[1]!, 2),
  )

  expect(finalGap).toBeGreaterThanOrEqual(initialGap - 1e-7)
})
