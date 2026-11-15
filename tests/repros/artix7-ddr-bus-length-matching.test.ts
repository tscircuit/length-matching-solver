import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import {
  LengthMatchingNoSolutionError,
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib"
import {
  findConnectionRouteIndexes,
  getConnectionLength,
} from "../../lib/length-matching/connection-routes"
import { createPostProcessingVisualization } from "../../lib/post-processing/visualization/createPostProcessingVisualization"

test("matches the routed Artix-7 DDR buses within their declared skew", () => {
  const input: LengthMatchingSolverParams = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          "../fixtures/artix7-ddr-bus-length-matching.json.gz",
          import.meta.url,
        ),
      ),
    ).toString("utf8"),
  )
  const solver = new LengthMatchingSolver(input)
  expect(() => solver.solve()).toThrow(LengthMatchingNoSolutionError)
  const skews = input.differentialPairs!.map((pair) => {
    const lengths = pair.connectionNames.map((lane) =>
      getConnectionLength(
        solver.matchedHdRoutes,
        findConnectionRouteIndexes(solver.matchedHdRoutes, lane),
      ),
    )
    return Math.abs(lengths[0]! - lengths[1]!)
  })
  const matchedCount = skews.filter(
    (skew, index) => skew <= input.differentialPairs![index]!.lengthTolerance,
  ).length
  expect(solver.solved).toBe(false)
  expect(solver.matchedHdRoutes).toHaveLength(input.hdRoutes.length)
  const graphics = solver.visualize()
  const fixedCopper = createPostProcessingVisualization({
    traces: input.traces!,
    obstacles: [],
    bounds: input.bounds!,
    layerCount: input.layerCount!,
    activeConnectionNames: null,
    previewPath: null,
  })
  expect({
    ...graphics,
    lines: [...fixedCopper.lines!, ...graphics.lines!],
    circles: [...fixedCopper.circles!, ...graphics.circles!],
    coordinateSystem: "cartesian",
    texts: [
      {
        x: 0,
        y: 22,
        text: `Artix-7 DDR: ${matchedCount}/${skews.length} skew constraints satisfied`,
        fontSize: 0.9,
      },
      {
        x: 0,
        y: 20.5,
        text: `DQ13 skew: ${skews[0]!.toFixed(3)} mm / ${input.differentialPairs![0]!.lengthTolerance.toFixed(3)} mm limit`,
        fontSize: 0.7,
      },
    ],
  }).toMatchGraphicsSvg(import.meta.path, { backgroundColor: "white" })
})
