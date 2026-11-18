import { expect, test } from "bun:test"
import { PostProcessingSolver, type HighDensityRoute } from "../../lib"

type PadArrangement = {
  name: string
  stagger: number
  vertical?: boolean
  reverseNegative?: boolean
  widths: [number, number]
  maxUncoupledLength?: number
}

test("honors requested facing-pad copper gaps", (): void => {
  const arrangements: PadArrangement[] = [
    { name: "aligned", stagger: 0, widths: [0.15, 0.15] },
    { name: "one micron stagger", stagger: 0.001, widths: [0.15, 0.15] },
    { name: "negative stagger", stagger: -0.001, widths: [0.15, 0.15] },
    { name: "larger stagger", stagger: 0.2, widths: [0.15, 0.15] },
    { name: "larger negative stagger", stagger: -0.2, widths: [0.15, 0.15] },
    { name: "wide stagger", stagger: 0.8, widths: [0.15, 0.15] },
    {
      name: "reversed member",
      stagger: 0.001,
      reverseNegative: true,
      widths: [0.15, 0.15],
    },
    {
      name: "vertical pair",
      stagger: 0.001,
      vertical: true,
      widths: [0.15, 0.15],
    },
    { name: "unequal widths", stagger: 0.001, widths: [0.1, 0.2] },
    {
      name: "bounded escape",
      stagger: 0.001,
      widths: [0.15, 0.15],
      maxUncoupledLength: 2,
    },
  ]
  for (const arrangement of arrangements) {
    for (const edgeGap of [0.3, 0.45]) {
      const hdRoutes: HighDensityRoute[] = [-0.5, 0.5].map(
        (transverse, lane): HighDensityRoute => {
          const stations =
            transverse < 0 && arrangement.reverseNegative ? [5, -5] : [-5, 5]
          return {
            connectionName: transverse < 0 ? "N" : "P",
            traceThickness: arrangement.widths[lane]!,
            viaDiameter: 0.3,
            vias: [],
            route: stations.map((station) => {
              const longitudinal =
                station + (transverse > 0 ? arrangement.stagger : 0)
              return arrangement.vertical
                ? { x: transverse, y: longitudinal, z: 0 }
                : { x: longitudinal, y: transverse, z: 0 }
            }),
          }
        },
      )
      const centerlineDistance =
        edgeGap + (arrangement.widths[0] + arrangement.widths[1]) / 2
      const solver = new PostProcessingSolver({
        hdRoutes,
        differentialPairs: [
          {
            connectionNames: ["P", "N"],
            lengthTolerance: 0.1,
            minimumCenterlineDistance: centerlineDistance,
            maximumCenterlineDistance: centerlineDistance,
            maxUncoupledLength: arrangement.maxUncoupledLength,
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
      expect(solver.solved, arrangement.name).toBe(true)
      expect(output.postProcessingErrors, arrangement.name).toEqual([])
      expect(output.hdRoutes).toHaveLength(2)
      for (const [lane, trace] of output.hdRoutes.entries()) {
        expect(trace.route[0]).toMatchObject(hdRoutes[lane]!.route[0]!)
        expect(trace.route.at(-1)).toMatchObject(hdRoutes[lane]!.route.at(-1)!)
        expect(trace.traceThickness).toBe(arrangement.widths[lane]!)
      }
      for (const station of [-3, 0, 3]) {
        const positions = output.hdRoutes.map(({ route }): number => {
          for (let index = 1; index < route.length; index++) {
            const start = route[index - 1]!
            const end = route[index]!
            const startStation = arrangement.vertical ? start.y : start.x
            const endStation = arrangement.vertical ? end.y : end.x
            if (
              startStation === endStation ||
              (startStation - station) * (endStation - station) > 0
            )
              continue
            expect(start.z).toBe(0)
            expect(end.z).toBe(0)
            const startTransverse = arrangement.vertical ? start.x : start.y
            const endTransverse = arrangement.vertical ? end.x : end.y
            return (
              startTransverse +
              ((station - startStation) * (endTransverse - startTransverse)) /
                (endStation - startStation)
            )
          }
          throw new Error(
            `No wire crosses station ${station} for ${arrangement.name}`,
          )
        })
        const measuredGap =
          Math.abs(positions[0]! - positions[1]!) -
          (arrangement.widths[0] + arrangement.widths[1]) / 2
        expect(
          measuredGap,
          `${arrangement.name}, requested ${edgeGap}, station ${station}`,
        ).toBeCloseTo(edgeGap, 6)
      }
    }
  }
})
