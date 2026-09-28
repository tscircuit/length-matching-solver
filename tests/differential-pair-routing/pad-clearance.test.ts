import { expect, test } from "bun:test"
import {
  DifferentialPairRoutingSolver,
  type DifferentialPairRoutingSrj,
} from "../../lib"
import { getSimplifiedTraceLength } from "../../lib/post-processing/length-matching/getSimplifiedTraceLength"
import { parseSimplifiedPcbTrace } from "../../lib/post-processing/model/parseSimplifiedPcbTrace"
import { readFileSync } from "node:fs"

test("routes and matches staggered terminals around neighboring pads", () => {
  const srj: DifferentialPairRoutingSrj = JSON.parse(
    readFileSync(new URL("./pad-clearance.srj.json", import.meta.url), "utf8"),
  )
  srj.differentialPairs![0]!.maxUncoupledLength = 3
  const solver = new DifferentialPairRoutingSolver(srj)
  solver.solve()
  const { routedTraces, srj: routedSrj } = solver.getOutput()
  expect(solver.solved).toBe(true)
  expect(routedTraces).toHaveLength(2)
  expect(routedSrj.connections).toEqual([])
  const lengths = routedTraces.map((trace) =>
    getSimplifiedTraceLength(parseSimplifiedPcbTrace(trace, srj.layerCount)),
  )
  expect(Math.abs(lengths[0]! - lengths[1]!)).toBeLessThanOrEqual(0.05)
  for (const [index, trace] of routedTraces.entries()) {
    expect(trace.route[0]).toMatchObject({
      x: srj.connections[index]!.pointsToConnect[0]!.x,
      y: srj.connections[index]!.pointsToConnect[0]!.y,
    })
    expect(trace.route.at(-1)).toMatchObject({
      x: srj.connections[index]!.pointsToConnect[1]!.x,
      y: srj.connections[index]!.pointsToConnect[1]!.y,
    })
  }
})
