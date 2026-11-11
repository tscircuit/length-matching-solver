import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../../lib"

test("reports excess skew on a whole path made entirely of preloaded traces", () => {
  const traces = [4, 3].map(
    (length, lane): SimplifiedPcbTrace => ({
      type: "pcb_trace",
      pcb_trace_id: `fixed_${lane}`,
      connection_name: lane === 0 ? "P" : "N",
      route: [0, length].map((x) => ({
        route_type: "wire",
        x,
        y: lane,
        width: 0.15,
        layer: "top",
      })),
    }),
  )
  const solver = new PostProcessingSolver({
    hdRoutes: [],
    traces,
    differentialPairs: [],
    differentialPairPaths: [
      {
        connectionNames: ["P", "N"],
        sections: [[{ pcbTraceId: "fixed_0" }, { pcbTraceId: "fixed_1" }]],
        lengthTolerance: 0.05,
      },
    ],
    obstacles: [],
    bounds: { minX: -1, maxX: 5, minY: -1, maxY: 2 },
    layerCount: 2,
  })

  solver.solve()

  const { hdRoutes, postProcessingErrors } = solver.getOutput()
  expect(hdRoutes).toEqual([])
  expect(postProcessingErrors).toEqual([
    expect.objectContaining({
      stage: "lengthMatchingSolver",
      connectionName: "N",
      reason: "no-meander-candidate",
    }),
  ])
})
