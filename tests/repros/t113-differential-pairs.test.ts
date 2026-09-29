import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { expect, test } from "bun:test"
import { DifferentialPairRoutingSolver } from "../../lib/DifferentialPairRoutingSolver"
import type { DifferentialPairRoutingSrj } from "../../lib/differential-pair-routing/types"
import { validateCandidateGeometry } from "../../lib/post-processing/geometry/validateCandidateGeometry"
import type { ParsedTrace } from "../../lib/post-processing/model/internal-types"
import { parseSimplifiedPcbTrace } from "../../lib/post-processing/model/parseSimplifiedPcbTrace"

test("routes all four T113 pairs without blocking later terminal fanouts", (): void => {
  const input: DifferentialPairRoutingSrj = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("./assets/t113-differential-pairs.srj.json.gz", import.meta.url),
      ),
    ).toString(),
  )
  const original = structuredClone(input)
  const solver = new DifferentialPairRoutingSolver(input)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(input).toEqual(original)
  const { routedTraces, srj } = solver.getOutput()
  expect(routedTraces).toHaveLength(8)
  expect(srj.connections).toHaveLength(input.connections.length - 8)
  for (const pair of input.differentialPairs!) {
    const members = pair.connectionNames.map((name): ParsedTrace => {
      const trace = routedTraces.find((trace) => trace.connection_name === name)
      if (!trace) throw new Error(`Missing differential-pair member ${name}`)
      return parseSimplifiedPcbTrace(trace, input.layerCount)
    })
    expect(
      validateCandidateGeometry(members[0]!, members[1]!, {
        ...srj,
        immutableTraces: routedTraces.filter(
          (trace) => !pair.connectionNames.includes(trace.connection_name),
        ),
      }),
    ).toBe(true)
  }
})
