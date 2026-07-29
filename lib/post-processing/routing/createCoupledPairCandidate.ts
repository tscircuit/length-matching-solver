import type {
  SimplifiedPcbTrace,
  SimplifiedPcbTraceRoutePoint,
  SimplifiedPcbTraceWireRoutePoint,
} from "../../types"
import type { PairCandidate, ParsedTrace, Point } from "../model/internal-types"
import { parseSimplifiedPcbTrace } from "../model/parseSimplifiedPcbTrace"
import type { CoupledPathPoint } from "./types"

/** Convert a layered spine into two corresponding offset simplified traces. */
export const createCoupledPairCandidate = (input: {
  first: ParsedTrace
  second: ParsedTrace
  reverseSecond: boolean
  path: CoupledPathPoint[]
  centerlineSpacing: number
  edgeGap: number
  side: 1 | -1
  layerCount: number
  terminalFanout?: boolean
}): PairCandidate => {
  const samePoint = (left: Point, right: Point): boolean =>
    Math.hypot(left.x - right.x, left.y - right.y) <= 1e-8
  if (input.path.length < 2)
    throw new Error(
      "PostProcessingSolver: coupled path has fewer than two stations",
    )
  const getSpatialNeighbor = (
    index: number,
    direction: -1 | 1,
  ): CoupledPathPoint | null => {
    for (
      let cursor = index + direction;
      cursor >= 0 && cursor < input.path.length;
      cursor += direction
    ) {
      const candidate = input.path[cursor]!
      if (!samePoint(candidate, input.path[index]!)) return candidate
    }
    return null
  }
  const getOffset = (index: number): Point => {
    const point = input.path[index]!
    const previous = getSpatialNeighbor(index, -1)
    const next = getSpatialNeighbor(index, 1)
    const createNormal = (from: Point, to: Point): Point => {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const length = Math.hypot(dx, dy)
      if (length <= 1e-10)
        throw new Error(
          "PostProcessingSolver: cannot offset a zero-length spine",
        )
      return { x: -dy / length, y: dx / length }
    }
    const halfSpacing = (input.side * input.centerlineSpacing) / 2
    if (!previous || !next) {
      const normal = createNormal(previous ?? point, next ?? point)
      return { x: normal.x * halfSpacing, y: normal.y * halfSpacing }
    }
    if (input.terminalFanout && index === 1)
      return createNormal(previous, point)
    if (input.terminalFanout && index === input.path.length - 2)
      return createNormal(point, next)
    if (input.terminalFanout && input.path[index + 1]?.layer !== point.layer)
      return createNormal(previous, point)
    const incomingNormal = createNormal(previous, point)
    const outgoingNormal = createNormal(point, next)
    const bisector = {
      x: incomingNormal.x + outgoingNormal.x,
      y: incomingNormal.y + outgoingNormal.y,
    }
    const bisectorLength = Math.hypot(bisector.x, bisector.y)
    if (bisectorLength <= 1e-10)
      throw new Error(
        "PostProcessingSolver: cannot offset a reversing spine corner",
      )
    const unitBisector = {
      x: bisector.x / bisectorLength,
      y: bisector.y / bisectorLength,
    }
    const projection =
      unitBisector.x * incomingNormal.x + unitBisector.y * incomingNormal.y
    const miterLength = halfSpacing / projection
    return { x: unitBisector.x * miterLength, y: unitBisector.y * miterLength }
  }
  const firstStart = input.first.points[0]!
  const firstEnd = input.first.points.at(-1)!
  const secondLogicalStart = input.reverseSecond
    ? input.second.points.at(-1)!
    : input.second.points[0]!
  const secondLogicalEnd = input.reverseSecond
    ? input.second.points[0]!
    : input.second.points.at(-1)!
  const routes: [
    SimplifiedPcbTraceRoutePoint[],
    SimplifiedPcbTraceRoutePoint[],
  ] = [
    [
      {
        route_type: "wire",
        x: firstStart.x,
        y: firstStart.y,
        width: firstStart.width,
        layer: firstStart.layer,
      },
    ],
    [
      {
        route_type: "wire",
        x: secondLogicalStart.x,
        y: secondLogicalStart.y,
        width: secondLogicalStart.width,
        layer: secondLogicalStart.layer,
      },
    ],
  ]
  const viaTemplates = [input.first.transitions[0], input.second.transitions[0]]
  let viaPairCount = 0

  const routeStartIndex = input.terminalFanout ? 1 : 0
  const lastStationIndex = input.path.length - 2
  const lastStation = input.path[lastStationIndex]
  const penultimateStation = input.path[lastStationIndex - 1]
  const omitTerminalMiterStations =
    input.terminalFanout &&
    lastStation?.layer === firstEnd.layer &&
    penultimateStation?.layer === lastStation.layer
  const routeEndIndex = input.terminalFanout
    ? omitTerminalMiterStations
      ? lastStationIndex - 1
      : input.path.length - 1
    : input.path.length
  for (let index = routeStartIndex; index < routeEndIndex; index++) {
    const station = input.path[index]!
    const offset = getOffset(index)
    for (const lane of [0, 1] as const) {
      const polarity = lane === 0 ? 1 : -1
      const point = {
        x: station.x + offset.x * polarity,
        y: station.y + offset.y * polarity,
      }
      const route = routes[lane]
      const previous = input.path[index - 1]
      if (previous && previous.layer !== station.layer) {
        if (!samePoint(previous, station))
          throw new Error(
            "PostProcessingSolver: a coupled layer transition moved in the plane",
          )
        const lastWire = [...route]
          .reverse()
          .find(
            (entry): entry is SimplifiedPcbTraceWireRoutePoint =>
              entry.route_type === "wire",
          )
        if (!lastWire)
          throw new Error(
            "PostProcessingSolver: generated via has no preceding wire",
          )
        const template = viaTemplates[lane]
        route.push({
          route_type: "via",
          x: lastWire.x,
          y: lastWire.y,
          from_layer: previous.layer,
          to_layer: station.layer,
          via_diameter:
            template?.via_diameter ??
            (lane === 0
              ? input.first.viaDiameter
              : input.second.viaDiameter),
          ...(template?.via_hole_diameter !== undefined
            ? { via_hole_diameter: template.via_hole_diameter }
            : {}),
        })
        route.push({
          route_type: "wire",
          x: lastWire.x,
          y: lastWire.y,
          width: lane === 0 ? input.first.width : input.second.width,
          layer: station.layer,
        })
      } else {
        const last = route.at(-1)
        if (
          last?.route_type !== "wire" ||
          !samePoint(last, point) ||
          last.layer !== station.layer
        )
          route.push({
            route_type: "wire",
            ...point,
            width: lane === 0 ? input.first.width : input.second.width,
            layer: station.layer,
          })
      }
    }
    if (input.path[index - 1]?.layer !== station.layer && index > 0)
      viaPairCount++
  }
  const appendTerminal = (
    route: SimplifiedPcbTraceRoutePoint[],
    endpoint: typeof firstEnd,
  ): void => {
    const last = route.at(-1)
    if (!last || last.route_type !== "wire")
      throw new Error(
        "PostProcessingSolver: terminal fanout has no preceding wire",
      )
    const preceding = route.at(-2)
    let terminalMitered = false
    if (
      preceding?.route_type === "wire" &&
      preceding.layer === last.layer &&
      last.layer === endpoint.layer
    ) {
      const incoming = { x: last.x - preceding.x, y: last.y - preceding.y }
      const outgoing = { x: endpoint.x - last.x, y: endpoint.y - last.y }
      const incomingLength = Math.hypot(incoming.x, incoming.y)
      const outgoingLength = Math.hypot(outgoing.x, outgoing.y)
      const isOrthogonalCorner =
        incomingLength > 1e-8 &&
        outgoingLength > 1e-8 &&
        Math.abs(incoming.x * outgoing.x + incoming.y * outgoing.y) <= 1e-8
      if (isOrthogonalCorner) {
        // Move the corner back by its orthogonal leg for a 45-degree pad entry.
        const miter = {
          x: last.x - (incoming.x / incomingLength) * outgoingLength,
          y: last.y - (incoming.y / incomingLength) * outgoingLength,
        }
        const remainingIncomingLength =
          (miter.x - preceding.x) * (incoming.x / incomingLength) +
          (miter.y - preceding.y) * (incoming.y / incomingLength)
        if (remainingIncomingLength > 1e-8) {
          last.x = miter.x
          last.y = miter.y
          terminalMitered = true
        }
      }
    }
    if (
      input.terminalFanout &&
      !terminalMitered &&
      last.x !== endpoint.x &&
      last.y !== endpoint.y
    )
      route.push({
        route_type: "wire",
        x: endpoint.x,
        y: last.y,
        width: endpoint.width,
        layer: endpoint.layer,
      })
    route.push({
      route_type: "wire",
      x: endpoint.x,
      y: endpoint.y,
      width: endpoint.width,
      layer: endpoint.layer,
    })
  }
  appendTerminal(routes[0], firstEnd)
  appendTerminal(routes[1], secondLogicalEnd)

  if (input.reverseSecond) {
    routes[1] = routes[1]
      .reverse()
      .map((entry) =>
        entry.route_type === "via"
          ? { ...entry, from_layer: entry.to_layer, to_layer: entry.from_layer }
          : entry,
      )
  }
  const applyEndpointMetadata = (
    route: SimplifiedPcbTraceRoutePoint[],
    parsed: ParsedTrace,
  ): void => {
    const wires = route.filter(
      (entry): entry is SimplifiedPcbTraceWireRoutePoint =>
        entry.route_type === "wire",
    )
    for (const wire of wires) {
      delete wire.start_pcb_port_id
      delete wire.end_pcb_port_id
    }
    if (parsed.startPortId) wires[0]!.start_pcb_port_id = parsed.startPortId
    if (parsed.endPortId) wires.at(-1)!.end_pcb_port_id = parsed.endPortId
  }
  applyEndpointMetadata(routes[0], input.first)
  applyEndpointMetadata(routes[1], input.second)
  const first: SimplifiedPcbTrace = { ...input.first.source, route: routes[0] }
  const second: SimplifiedPcbTrace = {
    ...input.second.source,
    route: routes[1],
  }
  const firstParsed = parseSimplifiedPcbTrace(first, input.layerCount)
  const secondParsed = parseSimplifiedPcbTrace(second, input.layerCount)
  return {
    first,
    second,
    firstParsed,
    secondParsed,
    edgeGap: input.edgeGap,
    centerlineDistance: input.centerlineSpacing,
    bendCount: Math.max(0, input.path.length - viaPairCount - 2),
    viaPairCount,
  }
}
