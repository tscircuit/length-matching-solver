import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"

test("routes an exact copper gap on a two-pin pair without an escape-length limit", () => {
  const traceWidth = 0.15
  for (const { gap, offset } of [
    { gap: 0.3, offset: 0 },
    { gap: 0.45, offset: 0 },
    { gap: 0.3, offset: 0.001 },
  ]) {
    const hdRoutes: HighDensityRoute[] = [-0.5, 0.5].map((y) => ({
      connectionName: y < 0 ? "N" : "P",
      traceThickness: traceWidth,
      viaDiameter: 0.3,
      vias: [],
      route: [-5, 5].map((x) => ({
        x: x + (y > 0 ? offset : 0),
        y,
        z: 0,
      })),
    }))
    const obstacles = hdRoutes.flatMap((route) =>
      route.route.map(({ x, y }) => ({
        type: "rect" as const,
        center: { x, y },
        width: 0.2,
        height: 0.2,
        layers: ["top"],
        connectedTo: [route.connectionName],
      })),
    )
    const solver = new PostProcessingSolver({
      hdRoutes,
      differentialPairs: [
        {
          connectionNames: ["P", "N"],
          lengthTolerance: 0.1,
          minimumCenterlineDistance: gap + traceWidth,
          maximumCenterlineDistance: gap + traceWidth,
        },
      ],
      obstacles,
      bounds: { minX: -10, maxX: 10, minY: -6, maxY: 6 },
      layerCount: 2,
      minTraceToPadEdgeClearance: 0.1,
    })
    solver.solve()
    const result = solver.getOutput()
    expect(solver.solved).toBe(true)
    expect(result.postProcessingErrors).toEqual([])
    expect(result.hdRoutes).toHaveLength(2)
    for (const x of [-3, 0, 3]) {
      const positions = result.hdRoutes.map(({ route }) => {
        const i = route.findIndex(
          (p, i) =>
            i > 0 &&
            route[i - 1]!.x !== p.x &&
            (route[i - 1]!.x - x) * (p.x - x) <= 0,
        )
        expect(i).toBeGreaterThan(0)
        const a = route[i - 1]!
        const b = route[i]!
        return a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x)
      })
      const measuredGap = Math.abs(positions[0]! - positions[1]!) - traceWidth
      expect(measuredGap).toBeCloseTo(gap, 6)
    }
    if (gap === 0.45) {
      expect(solver.finalVisualize()).toMatchGraphicsSvg(import.meta.path, {
        backgroundColor: "white",
      })
    }
  }
})
