import { expect, test } from "bun:test"
import {
  DifferentialPairPostProcessingSolver,
  type DifferentialPairPostProcessingSolverParams,
} from "../../lib"
import { getDifferentialPairTestParams } from "./getDifferentialPairTestParams"

test("routes multiple pairs in canonical order and promotes earlier copper", () => {
  const params = getDifferentialPairTestParams()
  const firstPairTraces = params.pcbTraces.map((pcbTrace) => ({
    ...structuredClone(pcbTrace),
    pcb_trace_id: `${pcbTrace.pcb_trace_id}_a`,
    source_trace_id: `${pcbTrace.source_trace_id}_a`,
    route: pcbTrace.route.map((routePoint) =>
      routePoint.route_type === "wire"
        ? { ...routePoint, y: routePoint.y + 1.5 }
        : routePoint,
    ),
  }))
  const secondPairTraces = params.pcbTraces.map((pcbTrace) => ({
    ...structuredClone(pcbTrace),
    pcb_trace_id: `${pcbTrace.pcb_trace_id}_b`,
    source_trace_id: `${pcbTrace.source_trace_id}_b`,
    route: pcbTrace.route.map((routePoint) =>
      routePoint.route_type === "wire"
        ? { ...routePoint, y: routePoint.y - 1.5 }
        : routePoint,
    ),
  }))
  const multiPairParams = {
    ...params,
    pcbTraces: [...firstPairTraces, ...secondPairTraces],
    differentialPairs: [
      {
        name: "B_PAIR",
        positiveSourceTraceId: "source_trace_positive_b",
        negativeSourceTraceId: "source_trace_negative_b",
        maxLengthSkew: 0.01,
      },
      {
        name: "A_PAIR",
        positiveSourceTraceId: "source_trace_positive_a",
        negativeSourceTraceId: "source_trace_negative_a",
        maxLengthSkew: 0.01,
      },
    ],
  } as unknown as DifferentialPairPostProcessingSolverParams
  const solver = new DifferentialPairPostProcessingSolver(multiPairParams)

  solver.solve()

  expect(
    solver
      .getOutput()
      .pairResults.map((pairResult) => String(pairResult.differentialPairName)),
  ).toEqual(["A_PAIR", "B_PAIR"])
  expect(
    solver
      .getOutput()
      .pairResults.every((pairResult) => pairResult.status === "routed"),
  ).toBe(true)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
