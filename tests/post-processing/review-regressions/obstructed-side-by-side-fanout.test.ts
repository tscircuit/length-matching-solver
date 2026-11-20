import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { DifferentialPairRoutingSession } from "../../../lib/post-processing/routing/DifferentialPairRoutingSession"

test("moves the coupled run past an obstacle between side-by-side start pads", () => {
  const createTrace = (
    connectionName: string,
    y: number,
  ): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `trace_${connectionName.toLowerCase()}`,
    connection_name: connectionName,
    route: [0, 20].map((x) => ({
      route_type: "wire",
      x,
      y,
      width: 0.15,
      layer: "top",
    })),
  })
  const obstacles = [
    {
      type: "rect" as const,
      center: { x: 0, y: 0 },
      width: 1,
      height: 1.6,
      layers: ["top"],
      connectedTo: [],
    },
  ]
  const solver = new DifferentialPairRoutingSession({
    pair: {
      connectionNames: ["P", "N"],
      lengthTolerance: 0.1,
      minimumCenterlineDistance: 0.3,
      maximumCenterlineDistance: 0.3,
    },
    traces: [createTrace("P", 1.5), createTrace("N", -1.5)],
    obstacles,
    bounds: { minX: -0.6, maxX: 20.6, minY: -2, maxY: 2 },
    layerCount: 2,
  })

  let progress = solver.getProgress()
  while (!solver.isComplete()) {
    solver.step()
    const nextProgress = solver.getProgress()
    expect(nextProgress).toBeGreaterThanOrEqual(progress)
    progress = nextProgress
  }
  const result = solver.getResult()

  expect(result.status).toBe("accepted")
  expect(result.candidate.edgeGap).toBeCloseTo(0.15, 8)
  const firstCoupledPoint = result.candidate.first.route[1]
  if (firstCoupledPoint?.route_type !== "wire")
    throw new Error("Expected the first coupled point to be wire geometry")
  expect(firstCoupledPoint.x).toBeGreaterThan(0.5)
})
