import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { parseSimplifiedPcbTrace } from "../../../lib/post-processing/model/parseSimplifiedPcbTrace"
import { createCoupledPairCandidate } from "../../../lib/post-processing/routing/createCoupledPairCandidate"
import type { CoupledPathPoint } from "../../../lib/post-processing/routing/types"

test("maintains lane offsets through composite-grid and via-adjacent miters", () => {
  const createParsedTrace = (
    id: string,
    name: string,
    start: CoupledPathPoint,
    end: CoupledPathPoint,
  ) => {
    const route: SimplifiedPcbTrace["route"] = [
      { route_type: "wire", ...start, width: 0.2 },
    ]
    if (start.layer !== end.layer)
      route.push({
        route_type: "via",
        x: start.x,
        y: start.y,
        from_layer: start.layer,
        to_layer: end.layer,
        via_diameter: 0.5,
      })
    route.push({ route_type: "wire", ...end, width: 0.2 })
    return parseSimplifiedPcbTrace(
      {
        type: "pcb_trace",
        pcb_trace_id: id,
        connection_name: name,
        route,
      },
      2,
    )
  }
  const offsetEndpoint = (
    path: CoupledPathPoint[],
    atStart: boolean,
    polarity: 1 | -1,
  ): CoupledPathPoint => {
    const point = path[atStart ? 0 : path.length - 1]!
    const neighbor = path[atStart ? 1 : path.length - 2]!
    const dx = atStart ? neighbor.x - point.x : point.x - neighbor.x
    const dy = atStart ? neighbor.y - point.y : point.y - neighbor.y
    const length = Math.hypot(dx, dy)
    return {
      x: point.x - (polarity * dy) / length,
      y: point.y + (polarity * dx) / length,
      layer: point.layer,
    }
  }
  const cases: Array<{
    name: string
    path: CoupledPathPoint[]
    firstCornerWireIndex: number
    secondCornerWireIndex: number
  }> = [
    {
      name: "45 degree",
      path: [
        { x: 0, y: 0, layer: "top" },
        { x: 2, y: 0, layer: "top" },
        { x: 3, y: 1, layer: "top" },
      ],
      firstCornerWireIndex: 1,
      secondCornerWireIndex: 1,
    },
    {
      name: "90 degree",
      path: [
        { x: 0, y: 0, layer: "top" },
        { x: 2, y: 0, layer: "top" },
        { x: 2, y: 2, layer: "top" },
      ],
      firstCornerWireIndex: 1,
      secondCornerWireIndex: 1,
    },
    {
      name: "mixed-grid seam",
      path: [
        { x: 0, y: 0, layer: "top" },
        { x: 2, y: 0, layer: "top" },
        { x: 2.75, y: 1.5, layer: "top" },
      ],
      firstCornerWireIndex: 1,
      secondCornerWireIndex: 1,
    },
    {
      name: "via-adjacent",
      path: [
        { x: 0, y: 0, layer: "top" },
        { x: 2, y: 0, layer: "top" },
        { x: 2, y: 0, layer: "bottom" },
        { x: 3, y: 1, layer: "bottom" },
      ],
      firstCornerWireIndex: 1,
      secondCornerWireIndex: 2,
    },
  ]

  for (const geometryCase of cases) {
    const first = createParsedTrace(
      `${geometryCase.name}-p`,
      "P",
      offsetEndpoint(geometryCase.path, true, 1),
      offsetEndpoint(geometryCase.path, false, 1),
    )
    const second = createParsedTrace(
      `${geometryCase.name}-n`,
      "N",
      offsetEndpoint(geometryCase.path, true, -1),
      offsetEndpoint(geometryCase.path, false, -1),
    )
    const candidate = createCoupledPairCandidate({
      first,
      second,
      reverseSecond: false,
      path: geometryCase.path,
      centerlineSpacing: 2,
      edgeGap: 1.8,
      side: 1,
      layerCount: 2,
    })
    if (!candidate) throw new Error("Expected an offsettable coupled path")
    const firstWires = candidate.first.route.filter(
      (entry) => entry.route_type === "wire",
    )
    const secondWires = candidate.second.route.filter(
      (entry) => entry.route_type === "wire",
    )
    const firstCorner = firstWires[geometryCase.firstCornerWireIndex]!
    const secondCorner = secondWires[geometryCase.firstCornerWireIndex]!
    const station = geometryCase.path[1]!
    const previous = geometryCase.path[0]!
    const next = geometryCase.path.at(-1)!
    const incomingLength = Math.hypot(
      station.x - previous.x,
      station.y - previous.y,
    )
    const outgoingLength = Math.hypot(next.x - station.x, next.y - station.y)
    const offset = {
      x: firstCorner.x - station.x,
      y: firstCorner.y - station.y,
    }
    const incomingNormal = {
      x: -(station.y - previous.y) / incomingLength,
      y: (station.x - previous.x) / incomingLength,
    }
    const outgoingNormal = {
      x: -(next.y - station.y) / outgoingLength,
      y: (next.x - station.x) / outgoingLength,
    }

    expect(
      Math.abs(offset.x * incomingNormal.x + offset.y * incomingNormal.y),
      geometryCase.name,
    ).toBeCloseTo(1, 10)
    expect(
      Math.abs(offset.x * outgoingNormal.x + offset.y * outgoingNormal.y),
      geometryCase.name,
    ).toBeCloseTo(1, 10)
    expect((firstCorner.x + secondCorner.x) / 2, geometryCase.name).toBeCloseTo(
      station.x,
      10,
    )
    expect((firstCorner.y + secondCorner.y) / 2, geometryCase.name).toBeCloseTo(
      station.y,
      10,
    )
    if (
      geometryCase.firstCornerWireIndex !== geometryCase.secondCornerWireIndex
    ) {
      const firstAfterVia = firstWires[geometryCase.secondCornerWireIndex]!
      const secondAfterVia = secondWires[geometryCase.secondCornerWireIndex]!
      expect(firstAfterVia).toMatchObject({
        x: firstCorner.x,
        y: firstCorner.y,
        layer: "bottom",
      })
      expect(secondAfterVia).toMatchObject({
        x: secondCorner.x,
        y: secondCorner.y,
        layer: "bottom",
      })
    }
  }
})
