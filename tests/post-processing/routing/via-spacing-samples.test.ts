import { expect, test } from "bun:test"
import { createPairTerminalTraces } from "../../../lib/differential-pair-routing/createPairTerminalTraces"
import type { DifferentialPairRoutingSrj } from "../../../lib/differential-pair-routing/types"
import { parseSimplifiedPcbTrace } from "../../../lib/post-processing/model/parseSimplifiedPcbTrace"
import { getPairCenterlineDistanceSamples } from "../../../lib/post-processing/routing/getPairCenterlineDistanceSamples"

test("samples close multilayer lanes without overlapping the paired vias", (): void => {
  const srj: DifferentialPairRoutingSrj = {
    layerCount: 4,
    minTraceWidth: 0.1,
    minViaDiameter: 0.45,
    bounds: { minX: -2, maxX: 12, minY: -2, maxY: 2 },
    obstacles: [],
    connections: ["P", "N"].map((name, index) => ({
      name,
      pointsToConnect: [
        { x: 0, y: index * 0.4, layer: "top" },
        { x: 10, y: index * 0.4, layer: "bottom" },
      ],
    })),
  }
  const traces = createPairTerminalTraces(srj.connections, srj).map((trace) =>
    parseSimplifiedPcbTrace(trace, srj.layerCount),
  )
  const spacings = getPairCenterlineDistanceSamples(
    { connectionNames: ["P", "N"], lengthTolerance: 1 },
    traces[0]!,
    traces[1]!,
  )
  expect(Math.min(...spacings)).toBeGreaterThanOrEqual(0.45)
  expect(spacings).toContain(0.5)
  expect(spacings).toContain(0.55)
})
