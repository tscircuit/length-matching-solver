import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { DifferentialPairRoutingSession } from "../../../lib/post-processing/routing/DifferentialPairRoutingSession"

test("an already-coupled pair can route less than one grid step", () => {
  const traces: SimplifiedPcbTrace[] = [-0.3, 0.3].map((y) => ({
    type: "pcb_trace",
    pcb_trace_id: y > 0 ? "p" : "n",
    connection_name: y > 0 ? "P" : "N",
    route: [0, 0.2].map((x) => ({
      route_type: "wire",
      x,
      y,
      width: 0.15,
      layer: "top",
    })),
  }))
  const session = new DifferentialPairRoutingSession({
    pair: {
      connectionNames: ["P", "N"],
      lengthTolerance: 0.1,
      minimumCenterlineDistance: 0.6,
      maximumCenterlineDistance: 0.6,
    },
    traces,
    obstacles: [],
    bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    layerCount: 2,
  })
  while (!session.isComplete()) session.step()
  const { candidate } = session.getResult()
  expect(candidate.centerlineDistance).toBeCloseTo(0.6, 8)
  for (const trace of [candidate.first, candidate.second]) {
    const input = traces.find((t) => t.connection_name === trace.connection_name)!
    expect(trace.route[0]).toMatchObject(input.route[0]!)
    expect(trace.route.at(-1)).toMatchObject(input.route[1]!)
    const y = trace.connection_name === "P" ? 0.3 : -0.3
    let previousX = 0
    for (const point of trace.route) {
      if (point.route_type !== "wire")
        throw new Error("Expected a direct top-layer wire")
      expect(point).toMatchObject({ y, width: 0.15, layer: "top" })
      expect(point.x).toBeGreaterThanOrEqual(previousX)
      previousX = point.x
    }
  }
})
