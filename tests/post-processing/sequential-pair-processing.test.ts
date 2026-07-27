import { expect, test } from "bun:test"
import { PostProcessingSolver, type SimplifiedPcbTrace } from "../../lib"
import { getMinimumSegmentDistance } from "../../lib/route-geometry"
import { createPostProcessingTestParams } from "./createPostProcessingTestParams"

test("processes declared pairs sequentially while retaining all trace identities", () => {
  const params = createPostProcessingTestParams()
  const shifted = params.traces.map(
    (trace): SimplifiedPcbTrace => ({
      ...trace,
      pcb_trace_id: `${trace.pcb_trace_id}_2`,
      connection_name: `${trace.connection_name}2`,
      route: trace.route.map((entry) =>
        entry.route_type === "wire" ? { ...entry, y: entry.y + 7 } : entry,
      ),
    }),
  )
  const solver = new PostProcessingSolver({
    ...params,
    traces: [...params.traces, ...shifted],
    differentialPairs: [
      { connectionNames: ["P", "N"], lengthTolerance: 0.01 },
      { connectionNames: ["P2", "N2"], lengthTolerance: 0.01 },
    ],
    bounds: { minX: -2, maxX: 12, minY: -5, maxY: 12 },
  })
  solver.solve()
  const output = solver.getOutput()
  expect(output.errors).toHaveLength(0)
  expect(output.traces.map((trace) => trace.connection_name)).toEqual([
    "P",
    "N",
    "P2",
    "N2",
  ])
  expect(output.traces.every((trace) => trace.route.length > 2)).toBe(true)
  for (const earlier of output.traces.slice(0, 2)) {
    for (const later of output.traces.slice(2)) {
      for (
        let firstIndex = 0;
        firstIndex < earlier.route.length - 1;
        firstIndex++
      ) {
        const firstStart = earlier.route[firstIndex]
        const firstEnd = earlier.route[firstIndex + 1]
        if (
          firstStart?.route_type !== "wire" ||
          firstEnd?.route_type !== "wire" ||
          firstStart.layer !== firstEnd.layer
        )
          continue
        for (
          let secondIndex = 0;
          secondIndex < later.route.length - 1;
          secondIndex++
        ) {
          const secondStart = later.route[secondIndex]
          const secondEnd = later.route[secondIndex + 1]
          if (
            secondStart?.route_type !== "wire" ||
            secondEnd?.route_type !== "wire" ||
            secondStart.layer !== secondEnd.layer ||
            firstStart.layer !== secondStart.layer
          )
            continue
          const required =
            firstStart.width / 2 +
            secondStart.width / 2 +
            Math.max(firstStart.width, secondStart.width)
          expect(
            getMinimumSegmentDistance(
              firstStart,
              firstEnd,
              secondStart,
              secondEnd,
            ),
          ).toBeGreaterThanOrEqual(required - 1e-7)
        }
      }
    }
  }
})
