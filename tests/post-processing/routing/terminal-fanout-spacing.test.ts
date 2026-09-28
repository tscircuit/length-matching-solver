import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { parseSimplifiedPcbTrace } from "../../../lib/post-processing/model/parseSimplifiedPcbTrace"
import { createCoupledPairCandidate } from "../../../lib/post-processing/routing/createCoupledPairCandidate"
import type { CoupledPathPoint } from "../../../lib/post-processing/routing/types"

test("preserves signed pair spacing at terminal fanout and paired vias", (): void => {
  const paths: CoupledPathPoint[][] = [
    [0, 2, 4, 6, 8, 10].map((x) => ({ x, y: 0, layer: "top" })),
    [
      { x: 0, y: 0, layer: "top" },
      { x: 2, y: 0, layer: "top" },
      { x: 4, y: 0, layer: "top" },
      { x: 4, y: 0, layer: "bottom" },
      { x: 6, y: 0, layer: "bottom" },
      { x: 8, y: 0, layer: "bottom" },
      { x: 10, y: 0, layer: "bottom" },
    ],
    [
      { x: 0, y: 0, layer: "top" },
      { x: 2, y: 0, layer: "top" },
      { x: 4, y: 0, layer: "top" },
      { x: 6, y: 0, layer: "top" },
      { x: 6, y: 0, layer: "bottom" },
      { x: 10, y: 0, layer: "bottom" },
    ],
  ]
  for (const path of paths) {
    for (const spacing of [0.2, 0.3, 0.9, 2]) {
      for (const side of [1, -1] as const) {
        for (const rotated of [false, true]) {
          for (const reverseSecond of [false, true]) {
            const traces: SimplifiedPcbTrace[] = [-0.5, 0.5].map((offset, index) => {
              const route: SimplifiedPcbTrace["route"] = [
                { route_type: "wire", x: offset, y: 0, layer: "top", width: 0.1 },
              ]
              const endLayer = path.at(-1)!.layer
              if (endLayer !== "top") {
                route.push(
                  { route_type: "wire", x: 4 + offset, y: 0, layer: "top", width: 0.1 },
                  { route_type: "via", x: 4 + offset, y: 0, from_layer: "top", to_layer: endLayer, via_diameter: 0.1 },
                  { route_type: "wire", x: 4 + offset, y: 0, layer: endLayer, width: 0.1 },
                )
              }
              route.push({ route_type: "wire", x: 10 + offset, y: 0, layer: endLayer, width: 0.1 })
              const orientedRoute: SimplifiedPcbTrace["route"] = route.map((point) => {
                if (point.route_type !== "wire" && point.route_type !== "via")
                  throw new Error("Expected only wire and via geometry")
                return {
                  ...point,
                  x: rotated ? -point.y : point.x,
                  y: rotated ? point.x : point.y,
                }
              })
              if (index === 1 && reverseSecond) {
                orientedRoute.reverse()
                for (const point of orientedRoute) {
                  if (point.route_type !== "via") continue
                  const fromLayer = point.from_layer
                  point.from_layer = point.to_layer
                  point.to_layer = fromLayer
                }
              }
              return { type: "pcb_trace", pcb_trace_id: `trace_${index}`, connection_name: index === 0 ? "P" : "N", route: orientedRoute }
            })
            const candidate = createCoupledPairCandidate({
              first: parseSimplifiedPcbTrace(traces[0]!, 2),
              second: parseSimplifiedPcbTrace(traces[1]!, 2),
              reverseSecond,
              path: path.map((point) => ({
                ...point,
                x: rotated ? -point.y : point.x,
                y: rotated ? point.x : point.y,
              })),
              centerlineSpacing: spacing,
              edgeGap: spacing - 0.1,
              side,
              layerCount: 2,
              terminalFanout: true,
            })
            if (!candidate) throw new Error("Expected an offsettable inline pair")
            for (const x of [2, 4]) {
              const positive = candidate.firstParsed.points.find((point) => (rotated ? point.y : point.x) === x && Math.abs(rotated ? point.x : point.y) > 1e-8)
              const negative = candidate.secondParsed.points.find((point) => (rotated ? point.y : point.x) === x && Math.abs(rotated ? point.x : point.y) > 1e-8)
              if (!positive || !negative) throw new Error(`Missing station ${x}`)
              expect(rotated ? -positive.x : positive.y).toBeCloseTo(side * spacing / 2, 10)
              expect(rotated ? -negative.x : negative.y).toBeCloseTo(-side * spacing / 2, 10)
              expect(Math.hypot(positive.x - negative.x, positive.y - negative.y)).toBeCloseTo(spacing, 10)
            }
            const expectedViaCount = path.at(-1)!.layer === "top" ? 0 : 1
            expect(candidate.firstParsed.vias).toHaveLength(expectedViaCount)
            expect(candidate.secondParsed.vias).toHaveLength(expectedViaCount)
            if (expectedViaCount > 0) {
              const viaStation = path.find((point, index) => index > 0 && point.layer !== path[index - 1]!.layer)!
              for (const [member, polarity] of [[candidate.firstParsed, 1], [candidate.secondParsed, -1]] as const) {
                const via = member.vias[0]!
                expect(via.x).toBeCloseTo(rotated ? -polarity * side * spacing / 2 : viaStation.x, 10)
                expect(via.y).toBeCloseTo(rotated ? viaStation.x : polarity * side * spacing / 2, 10)
                expect(new Set(member.points.filter((point) => Math.hypot(point.x - via.x, point.y - via.y) < 1e-8).map((point) => point.layer))).toEqual(new Set(["top", "bottom"]))
              }
            }
            expect(candidate.first.route[0]).toMatchObject(traces[0]!.route[0]!)
            expect(candidate.second.route[0]).toMatchObject(traces[1]!.route[0]!)
          }
        }
      }
    }
  }
})
