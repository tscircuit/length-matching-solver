import { expect, test } from "bun:test"
import {
  DifferentialPairRoutingError,
  type SimplifiedPcbTrace,
} from "../../../lib"
import { solveDifferentialPair } from "../../../lib/post-processing/routing/solveDifferentialPair"

test("names every differential-pair preparation failure", () => {
  const createTrace = (
    connectionName: string,
    points: Array<{ x: number; y: number; layer: string }>,
  ): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `trace_${connectionName}`,
    connection_name: connectionName,
    route: points.map((point) => ({
      route_type: "wire",
      ...point,
      width: 0.2,
    })),
  })
  const solve = (traces: SimplifiedPcbTrace[]): void => {
    solveDifferentialPair({
      pair: { connectionNames: ["P", "N"], lengthTolerance: 0.01 },
      traces,
      obstacles: [],
      bounds: { minX: -1, maxX: 3, minY: -1, maxY: 1 },
      layerCount: 2,
    })
  }
  const failures: DifferentialPairRoutingError[] = []
  for (const traces of [
    [
      createTrace("P", [
        { x: 0, y: 0.2, layer: "top" },
        { x: 1, y: 0.2, layer: "top" },
      ]),
    ],
    [
      createTrace("P", [
        { x: 0, y: 0.2, layer: "top" },
        { x: 1, y: 0.2, layer: "top" },
      ]),
      createTrace("N", [
        { x: 0, y: -0.2, layer: "bottom" },
        { x: 1, y: -0.2, layer: "bottom" },
      ]),
    ],
    [
      createTrace("P", [
        { x: 0, y: 0, layer: "top" },
        { x: 1, y: 0, layer: "top" },
      ]),
      createTrace("N", [
        { x: 2, y: 0, layer: "top" },
        { x: 1, y: 0, layer: "top" },
      ]),
    ],
  ]) {
    try {
      solve(traces)
    } catch (error) {
      if (!(error instanceof DifferentialPairRoutingError)) throw error
      failures.push(error)
    }
  }
  expect(failures.map((failure) => failure.reason)).toEqual([
    "trace-resolution-failure",
    "terminal-layer-mismatch",
    "coincident-terminal-midpoints",
  ])
  expect(
    failures.every(
      (failure) =>
        failure.name === "DifferentialPairRoutingError" &&
        failure.connectionNames.join("/") === "P/N",
    ),
  ).toBe(true)
})
