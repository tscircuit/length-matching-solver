import { expect, test } from "bun:test"
import { DifferentialPairPostProcessingSolver } from "../../lib"
import { getDifferentialPairTestParams } from "./getDifferentialPairTestParams"

test("changes layers only through a paired via transition", () => {
  const solver = new DifferentialPairPostProcessingSolver(
    getDifferentialPairTestParams({
      positiveEndLayer: "bottom",
      negativeEndLayer: "bottom",
    }),
  )

  solver.solve()

  const pairResult = solver.getOutput().pairResults[0]
  expect(pairResult?.status).toBe("routed")
  if (pairResult?.status !== "routed") {
    throw new Error("Expected the pair to route through paired vias")
  }
  const positiveRouteVias = pairResult.positivePcbTrace.route.filter(
    (routePoint) => routePoint.route_type === "via",
  )
  const negativeRouteVias = pairResult.negativePcbTrace.route.filter(
    (routePoint) => routePoint.route_type === "via",
  )
  expect(positiveRouteVias).toHaveLength(1)
  expect(negativeRouteVias).toHaveLength(1)

  const positiveRouteVia = positiveRouteVias[0]!
  const negativeRouteVia = negativeRouteVias[0]!
  expect(
    `${String(positiveRouteVia.from_layer)}->${String(positiveRouteVia.to_layer)}`,
  ).toBe("top->bottom")
  expect(
    `${String(negativeRouteVia.from_layer)}->${String(negativeRouteVia.to_layer)}`,
  ).toBe("top->bottom")
  expect(positiveRouteVia.x).toBe(negativeRouteVia.x)
  expect(positiveRouteVia.y - negativeRouteVia.y).toBeCloseTo(0.3)
  expect(pairResult.pcbVias).toEqual([
    expect.objectContaining({
      x: positiveRouteVia.x,
      y: positiveRouteVia.y,
      layers: ["top", "bottom"],
      pcb_trace_id: "pcb_trace_positive",
    }),
    expect.objectContaining({
      x: negativeRouteVia.x,
      y: negativeRouteVia.y,
      layers: ["top", "bottom"],
      pcb_trace_id: "pcb_trace_negative",
    }),
  ])
})
