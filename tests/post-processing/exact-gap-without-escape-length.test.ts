import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"

test("routes an exact copper gap on a two-pin pair without an escape-length limit", () => {
  const traceWidth = 0.15
  const hdRoutes: HighDensityRoute[] = [-0.5, 0.5].map((y) => ({
    connectionName: y < 0 ? "N" : "P",
    traceThickness: traceWidth,
    viaDiameter: 0.3,
    vias: [],
    route: [-5, 5].map((x) => ({ x, y, z: 0 })),
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
  for (const gap of [0.3, 0.45]) {
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
          (p, i) => i > 0 && route[i - 1]!.x < x && p.x >= x,
        )
        expect(i).toBeGreaterThan(0)
        const a = route[i - 1]!
        const b = route[i]!
        return a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x)
      })
      const measuredGap = Math.abs(positions[0]! - positions[1]!) - traceWidth
      expect(measuredGap).toBeCloseTo(0.25, 6)
    }
    if (gap === 0.45) {
      expect(solver.finalVisualize()).toMatchGraphicsSvg(import.meta.path, {
        backgroundColor: "white",
      })
    }
  }
})
