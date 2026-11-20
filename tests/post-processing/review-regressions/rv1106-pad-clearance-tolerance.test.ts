import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"
import { getRouteLength } from "../../../lib/route-geometry"

test("selects a meander that passes final pad clearance on the RV1106 pair", async (): Promise<void> => {
  const fixture = new URL(
    "../../../fixtures/rv1106g2-reversing-spine/rv1106g2-reversing-spine.json",
    import.meta.url,
  )
  const input: PostProcessingSolverParams = await Bun.file(fixture).json()
  const { traces: _fixedCopper, ...params } = input
  const pair = input.differentialPairs.find(({ connectionNames }) =>
    connectionNames.includes("source_trace_222"),
  )
  if (!pair) throw new Error("Expected the mixed-orientation RV1106 pair")
  const solver = new PostProcessingSolver({
    ...params,
    hdRoutes: input.hdRoutes.filter(({ connectionName }) =>
      pair.connectionNames.includes(connectionName),
    ),
    differentialPairs: [pair],
  })
  solver.solve()

  const { hdRoutes, postProcessingErrors } = solver.getOutput()
  expect(postProcessingErrors).toEqual([])
  const [first, second] = hdRoutes
  if (!first || !second) throw new Error("Expected both RV1106 routes")
  const skew = Math.abs(getRouteLength(first) - getRouteLength(second))
  expect(skew).toBeLessThanOrEqual(pair.lengthTolerance)
})
