import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import {
  getConnectionLength,
  findConnectionRouteIndexes,
} from "../../lib/length-matching/connection-routes"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib"

// Captured byte-bus regression; opt in for the large geometry fixture.
// Run with the command-level timeout documented alongside the fixture.
const reproTest = process.env.RUN_AM3352_DDR_REPRO === "1" ? test : test.skip

reproTest(
  "AM3352 DDR_D0 matches while preserving existing terminal leads",
  () => {
    const params: LengthMatchingSolverParams = JSON.parse(
      gunzipSync(
        readFileSync(
          new URL(
            "../../fixtures/am3352-ddr-d0/input.json.gz",
            import.meta.url,
          ),
        ),
      ).toString("utf8"),
    )
    expect(params.layerCount).toBe(8)
    expect(params.obstacleMargin).toBe(0.1)
    expect(params.differentialPairs?.[0]?.connectionNames[0]).toBe(
      "source_net_70",
    )
    expect(params.differentialPairs?.[0]?.lengthTolerance).toBe(0.635)

    const solver = new LengthMatchingSolver(params)
    const start = performance.now()
    solver.solve()
    console.info(
      `AM3352 DDR_D0 reproduction: ${((performance.now() - start) / 1000).toFixed(3)}s, ${solver.iterations} iterations`,
    )
    expect(solver.failed).toBe(false)
    expect(solver.solved).toBe(true)
    const output = solver.getOutput().matchedHdRoutes
    const lengths = ["source_net_70", "source_net_87"].map((name) =>
      getConnectionLength(output, findConnectionRouteIndexes(output, name)),
    )
    expect(Math.abs(lengths[0]! - lengths[1]!)).toBeLessThanOrEqual(0.635)
    for (let i = 0; i < params.hdRoutes.length; i++) {
      const original = params.hdRoutes[i]!
      const result = output[i]!
      expect(result.route[0]).toEqual(original.route[0])
      expect(result.route.at(-1)).toEqual(original.route.at(-1))
      expect(result.vias).toEqual(original.vias)
      if (original.connectionName !== "source_net_70")
        expect(result).toEqual(original)
    }
    expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
  },
)
