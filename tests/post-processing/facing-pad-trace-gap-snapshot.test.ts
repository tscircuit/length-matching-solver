import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"

test("snapshots copper between staggered facing pads", (): void => {
  const traceWidth = 0.15
  const requestedGap = 0.3
  const hdRoutes: HighDensityRoute[] = [-0.5, 0.5].map(
    (y): HighDensityRoute => ({
      connectionName: y < 0 ? "N" : "P",
      traceThickness: traceWidth,
      viaDiameter: 0.3,
      vias: [],
      route: [-5, 5].map((x) => ({
        x: x + (y > 0 ? 0.2 : 0),
        y,
        z: 0,
      })),
    }),
  )
  const centerlineDistance = requestedGap + traceWidth
  const solver = new PostProcessingSolver({
    hdRoutes,
    differentialPairs: [
      {
        connectionNames: ["P", "N"],
        lengthTolerance: 0.1,
        minimumCenterlineDistance: centerlineDistance,
        maximumCenterlineDistance: centerlineDistance,
      },
    ],
    obstacles: hdRoutes.flatMap((trace) =>
      trace.route.map(({ x, y }) => ({
        type: "rect" as const,
        center: { x, y },
        width: 0.2,
        height: 0.2,
        layers: ["top"],
        connectedTo: [trace.connectionName],
      })),
    ),
    bounds: { minX: -10, maxX: 10, minY: -10, maxY: 10 },
    layerCount: 2,
    minTraceToPadEdgeClearance: 0.1,
  })
  solver.solve()
  const output = solver.getOutput()
  expect(solver.solved).toBe(true)
  expect(output.postProcessingErrors).toEqual([])
  expect(output.hdRoutes).toHaveLength(2)
  const centerYs = output.hdRoutes.map(({ route }): number => {
    for (let index = 1; index < route.length; index++) {
      const start = route[index - 1]!
      const end = route[index]!
      if (start.x === end.x || start.x * end.x > 0) continue
      expect(start.z).toBe(0)
      expect(end.z).toBe(0)
      return start.y - (start.x * (end.y - start.y)) / (end.x - start.x)
    }
    throw new Error("No top-layer wire crosses the midpoint")
  })
  const measuredGap = Math.abs(centerYs[0]! - centerYs[1]!) - traceWidth
  // Record current copper here; the expected-failure matrix asserts the request.
  expect(measuredGap).not.toBeCloseTo(requestedGap, 6)
  expect(solver.finalVisualize()).toMatchGraphicsSvg(import.meta.path, {
    backgroundColor: "white",
  })
})
