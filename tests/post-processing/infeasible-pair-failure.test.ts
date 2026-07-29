import { expect, test } from "bun:test"
import {
  DifferentialPairRoutingError,
  PostProcessingSolver,
  type SimplifiedPcbTrace,
} from "../../lib"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("throws a pair-specific error and stops before processing the next pair", () => {
  const params = createPostProcessingTestParams()
  const laterTraces = params.simpleRouteJson.traces.map(
    (trace): SimplifiedPcbTrace => ({
      ...trace,
      pcb_trace_id: `${trace.pcb_trace_id}_later`,
      connection_name: `${trace.connection_name}_LATER`,
      route: trace.route.map((entry) =>
        entry.route_type === "wire" ? { ...entry, y: entry.y + 10 } : entry,
      ),
    }),
  )
  const solver = new PostProcessingSolver({
    simpleRouteJson: {
      ...params.simpleRouteJson,
      traces: [...params.simpleRouteJson.traces, ...laterTraces],
      differentialPairs: [
        { connectionNames: ["P", "N"], lengthTolerance: 0.01 },
        {
          connectionNames: ["P_LATER", "N_LATER"],
          lengthTolerance: 0.01,
        },
      ],
      obstacles: [
        {
          type: "rect",
          layers: ["top", "bottom"],
          center: { x: 5, y: 0 },
          width: 8,
          height: 9,
          connectedTo: [],
        },
      ],
    },
  })

  let thrown: unknown
  try {
    solver.solve()
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(DifferentialPairRoutingError)
  if (!(thrown instanceof DifferentialPairRoutingError)) throw thrown
  expect(thrown.name).toBe("DifferentialPairRoutingError")
  expect(thrown.connectionNames).toEqual(["P", "N"])
  expect(thrown.reason).toBe("no-valid-candidate")
  expect(solver.failed).toBe(true)
  expect(solver.solved).toBe(false)
  expect(solver.differentialPairReroutingSolver?.failed).toBe(true)
  expect(
    solver.differentialPairReroutingSolver?.computeProgress(),
  ).toBeLessThan(0.5)
  expect(solver.differentialPairReroutingSolver?.stats.pair).toBe("P/N")
  expect(solver.fortyFiveDegreeSimplificationSolver).toBeUndefined()
  expect(solver.lengthMatchingSolver).toBeUndefined()
  expect(solver.simplifiedTraceReconstructionSolver).toBeUndefined()
  expect(() => solver.getOutput()).toThrow(/before the solver completed/)
})
