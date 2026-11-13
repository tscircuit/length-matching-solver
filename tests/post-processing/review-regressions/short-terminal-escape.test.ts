import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { DifferentialPairRoutingSession } from "../../../lib/post-processing/routing/DifferentialPairRoutingSession"

test("routes short coupled spans after pad escape", (): void => {
  for (const maxUncoupledLength of [undefined, 2]) {
    const traces: SimplifiedPcbTrace[] = [-0.5, 0.5].map(
      (y): SimplifiedPcbTrace => ({
        type: "pcb_trace",
        pcb_trace_id: y > 0 ? "p" : "n",
        connection_name: y > 0 ? "P" : "N",
        route: [0, 0.7].map((x) => ({
          route_type: "wire",
          x,
          y,
          width: 0.15,
          layer: "top",
        })),
      }),
    )
    const session = new DifferentialPairRoutingSession({
      pair: {
        connectionNames: ["P", "N"],
        lengthTolerance: 0.1,
        minimumCenterlineDistance: 0.45,
        maximumCenterlineDistance: 0.45,
        maxUncoupledLength,
      },
      traces,
      obstacles: [],
      bounds: { minX: -1, maxX: 2, minY: -1, maxY: 1 },
      layerCount: 2,
    })
    while (!session.isComplete()) session.step()
    const { candidate } = session.getResult()
    expect(candidate.centerlineDistance).toBeCloseTo(0.45, 8)
    for (const trace of [candidate.first, candidate.second]) {
      const trunk = trace.route.slice(1, -1)
      expect(trunk).toHaveLength(2)
      const start = trunk[0]!
      const end = trunk[1]!
      if (start.route_type !== "wire" || end.route_type !== "wire")
        throw new Error("Expected a straight top-layer coupled run")
      expect(start).toMatchObject({
        route_type: "wire",
        y: trace.connection_name === "P" ? 0.225 : -0.225,
        width: 0.15,
        layer: "top",
      })
      expect(end.y).toBe(start.y)
      expect(end.x - start.x).toBeGreaterThan(0)
      expect(end.x - start.x).toBeLessThan(0.25)
    }
  }
})
