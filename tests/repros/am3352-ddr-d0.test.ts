import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import {
  LengthMatchingNoSolutionError,
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib"

// This is an observed-failure reproduction, not a claim of geometric feasibility.
// Opt in because the exhausted-search path can take several minutes.
const reproTest = process.env.RUN_AM3352_DDR_REPRO === "1" ? test : test.skip

reproTest("AM3352 DDR_D0 exhausts the captured byte-bus matching search", () => {
  const params: LengthMatchingSolverParams = JSON.parse(
    gunzipSync(readFileSync(
      new URL("../../fixtures/am3352-ddr-d0/input.json.gz", import.meta.url),
    )).toString("utf8"),
  )
  expect(params.layerCount).toBe(8)
  expect(params.obstacleMargin).toBe(0.1)
  expect(params.differentialPairs?.[0]?.connectionNames[0]).toBe("source_net_70")
  expect(params.differentialPairs?.[0]?.lengthTolerance).toBe(0.635)

  const solver = new LengthMatchingSolver(params)
  const start = performance.now()
  let failure: unknown
  try {
    solver.solve()
  } catch (error) {
    failure = error
  }
  console.info(`AM3352 DDR_D0 reproduction: ${((performance.now() - start) / 1000).toFixed(3)}s, ${solver.iterations} iterations`)
  expect(failure).toBeInstanceOf(LengthMatchingNoSolutionError)
  expect(failure).toMatchObject({
    connectionName: "source_net_70",
    reason: "meander-search-exhausted",
  })
  expect((failure as Error).message).toContain("required 9.9183mm")
  expect(solver.failed).toBe(true)
  expect(solver.solved).toBe(false)
})
