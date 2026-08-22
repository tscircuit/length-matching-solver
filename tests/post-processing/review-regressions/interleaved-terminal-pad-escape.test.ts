import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { DifferentialPairRoutingSession } from "../../../lib/post-processing/routing/DifferentialPairRoutingSession"

test("couples an exact-gap pair after escaping an interleaved terminal pad", () => {
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
  const obstacles = [0, 20].flatMap((x) => [
    {
      type: "rect" as const,
      center: { x, y: 0.5 },
      width: 1,
      height: 0.3,
      layers: ["top"],
      connectedTo: ["P"],
    },
    {
      type: "rect" as const,
      center: { x, y: 0 },
      width: 1,
      height: 0.3,
      layers: ["top"],
      connectedTo: [],
    },
    {
      type: "rect" as const,
      center: { x, y: -0.5 },
      width: 1,
      height: 0.3,
      layers: ["top"],
      connectedTo: ["N"],
    },
  ])
  const solver = new DifferentialPairRoutingSession({
    pair: {
      connectionNames: ["P", "N"],
      lengthTolerance: 0.1,
      minimumCenterlineDistance: 0.3,
      maximumCenterlineDistance: 0.3,
      maxUncoupledLength: 3,
    },
    traces: [createTrace("P", 0.5), createTrace("N", -0.5)],
    obstacles,
    bounds: { minX: -0.6, maxX: 20.6, minY: -1.2, maxY: 1.2 },
    layerCount: 2,
  })

  while (!solver.isComplete()) solver.step()
  const result = solver.getResult()

  expect(result.status).toBe("accepted")
  expect(result.candidate.edgeGap).toBeCloseTo(0.15, 8)
  const firstCoupledPoint = result.candidate.first.route[1]
  if (firstCoupledPoint?.route_type !== "wire")
    throw new Error("Expected the first coupled point to be wire geometry")
  expect(firstCoupledPoint.x).toBeGreaterThan(0.5)
  expect(Math.hypot(firstCoupledPoint.x, firstCoupledPoint.y - 0.5)).toBeLessThanOrEqual(3)
})
