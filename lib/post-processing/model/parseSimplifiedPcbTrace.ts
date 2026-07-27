import type { SimplifiedPcbTrace } from "../../types"
import { getLayerIndex } from "../geometry/getLayerIndex"
import { getTransitionLayers } from "../geometry/getTransitionLayers"
import type { CopperSegment, ParsedTrace, PathPoint } from "./internal-types"

const POSITION_EPSILON = 1e-8

/** Parse an ordered wire/via stream into continuous, layer-aware copper. */
export const parseSimplifiedPcbTrace = (
  trace: SimplifiedPcbTrace,
  layerCount: number,
): ParsedTrace => {
  if (trace.route.length === 0)
    throw new Error(`trace "${trace.connection_name}" has an empty route`)
  if (trace.route.some((entry) => entry.route_type !== "wire" && entry.route_type !== "via"))
    throw new Error(
      `trace "${trace.connection_name}" contains unsupported jumper or through-obstacle geometry`,
    )

  const firstWireIndex = trace.route.findIndex(
    (entry) => entry.route_type === "wire",
  )
  const firstWire = trace.route[firstWireIndex]
  const lastWire = trace.route.findLast((entry) => entry.route_type === "wire")
  if (firstWire?.route_type !== "wire" || !lastWire)
    throw new Error(`trace "${trace.connection_name}" must contain a wire point`)

  const points: PathPoint[] = []
  const segments: CopperSegment[] = []
  const vias: ParsedTrace["vias"] = []
  const transitions: ParsedTrace["transitions"] = []
  let current: PathPoint | null = null
  let maximumWidth = firstWire.width
  if (firstWireIndex > 0) {
    let inferredLayer = firstWire.layer
    for (let index = firstWireIndex - 1; index >= 0; index--) {
      const leadingEntry = trace.route[index]
      if (leadingEntry?.route_type !== "via")
        throw new Error(
          `trace "${trace.connection_name}" has unsupported geometry before its first wire`,
        )
      if (inferredLayer === leadingEntry.to_layer)
        inferredLayer = leadingEntry.from_layer
      else if (inferredLayer === leadingEntry.from_layer)
        inferredLayer = leadingEntry.to_layer
      else
        throw new Error(
          `trace "${trace.connection_name}" has discontinuous leading vias`,
        )
    }
    const leadingVia = trace.route[0]!
    if (leadingVia.route_type !== "via")
      throw new Error(`trace "${trace.connection_name}" has an invalid leading entry`)
    current = {
      x: leadingVia.x,
      y: leadingVia.y,
      layer: inferredLayer,
      width: firstWire.width,
    }
    points.push(current)
  }

  for (const entry of trace.route) {
    if (entry.route_type === "wire") {
      if (
        !Number.isFinite(entry.x) ||
        !Number.isFinite(entry.y) ||
        !Number.isFinite(entry.width) ||
        entry.width <= 0 ||
        getLayerIndex(entry.layer, layerCount) < 0
      )
        throw new Error(
          `trace "${trace.connection_name}" has an invalid wire point`,
        )
      maximumWidth = Math.max(maximumWidth, entry.width)
      const next = { x: entry.x, y: entry.y, layer: entry.layer, width: entry.width }
      if (current) {
        if (current.layer !== next.layer)
          throw new Error(
            `trace "${trace.connection_name}" changes layers without a via`,
          )
        if (Math.hypot(current.x - next.x, current.y - next.y) > POSITION_EPSILON)
          segments.push({
            start: current,
            end: next,
            layer: next.layer,
            width: Math.max(current.width, next.width),
            connectionName: trace.connection_name,
            terminal: null,
          })
      }
      points.push(next)
      current = next
      continue
    }

    if (entry.route_type !== "via")
      throw new Error(
        `trace "${trace.connection_name}" contains unsupported route geometry`,
      )
    if (!current)
      throw new Error(`trace "${trace.connection_name}" has a leading via`)
    const fromIndex = getLayerIndex(entry.from_layer, layerCount)
    const toIndex = getLayerIndex(entry.to_layer, layerCount)
    const viaDiameter = entry.via_diameter ?? current.width
    if (
      !Number.isFinite(entry.x) ||
      !Number.isFinite(entry.y) ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex === toIndex ||
      (entry.via_diameter !== undefined &&
        (!Number.isFinite(entry.via_diameter) || entry.via_diameter <= 0)) ||
      (entry.via_hole_diameter !== undefined &&
        (!Number.isFinite(entry.via_hole_diameter) ||
          entry.via_hole_diameter <= 0 ||
          entry.via_hole_diameter >= viaDiameter))
    )
      throw new Error(`trace "${trace.connection_name}" has an invalid via`)
    const fromLayer: string | null = current.layer === entry.from_layer
      ? entry.from_layer
      : current.layer === entry.to_layer
        ? entry.to_layer
        : null
    if (!fromLayer)
      throw new Error(
        `trace "${trace.connection_name}" has a discontinuous via transition`,
      )
    if (
      Math.hypot(current.x - entry.x, current.y - entry.y) > POSITION_EPSILON
    ) {
      segments.push({
        start: current,
        end: entry,
        layer: current.layer,
        width: current.width,
        connectionName: trace.connection_name,
        terminal: null,
      })
    }
    const toLayer: string =
      fromLayer === entry.from_layer ? entry.to_layer : entry.from_layer
    transitions.push({ ...entry, from_layer: fromLayer, to_layer: toLayer })
    vias.push({
      x: entry.x,
      y: entry.y,
      layers: getTransitionLayers(fromLayer, toLayer, layerCount),
      diameter: viaDiameter,
      connectionName: trace.connection_name,
      terminal: points.length === 1 ? "start" : null,
    })
    current = { x: entry.x, y: entry.y, layer: toLayer, width: current.width }
    points.push(current)
  }

  if (points.length < 2 || segments.length === 0)
    throw new Error(
      `trace "${trace.connection_name}" does not contain a routable path`,
    )
  segments[0]!.terminal = segments.length === 1 ? "both" : "start"
  segments[segments.length - 1]!.terminal = segments.length === 1 ? "both" : "end"
  if (trace.route.at(-1)?.route_type === "via" && vias.length > 0)
    vias.at(-1)!.terminal = "end"
  return {
    source: trace,
    points,
    segments,
    vias,
    transitions,
    width: maximumWidth,
    ...(firstWire.start_pcb_port_id
      ? { startPortId: firstWire.start_pcb_port_id }
      : {}),
    ...(lastWire.end_pcb_port_id
      ? { endPortId: lastWire.end_pcb_port_id }
      : {}),
  }
}
