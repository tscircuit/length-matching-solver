import type { SimplifiedPcbTrace } from "../../types"
import { getLayerIndex } from "../geometry/getLayerIndex"
import { getTransitionLayers } from "../geometry/getTransitionLayers"
import type { CopperSegment, CopperVia, Point } from "./internal-types"

/** Collect all copper from an immutable trace, including mixed special entries. */
export const getTraceCopperGeometry = (
  trace: SimplifiedPcbTrace,
  layerCount: number,
): { segments: CopperSegment[]; vias: CopperVia[] } => {
  const segments: CopperSegment[] = []
  const vias: CopperVia[] = []
  const firstWire = trace.route.find((entry) => entry.route_type === "wire")
  const inferredWidth =
    firstWire?.route_type === "wire" ? firstWire.width : null
  const jumperWidths = {
    "0603": 0.95,
    "1206": 1.8,
    "1206x4_pair": 1.8,
  } as const
  let current: (Point & { layer: string; width: number }) | null = null

  for (let index = 0; index < trace.route.length; index++) {
    const entry = trace.route[index]!
    if (entry.route_type === "wire") {
      if (
        !Number.isFinite(entry.x) ||
        !Number.isFinite(entry.y) ||
        !Number.isFinite(entry.width) ||
        entry.width <= 0 ||
        getLayerIndex(entry.layer, layerCount) < 0
      )
        throw new Error(
          `PostProcessingSolver: immutable trace "${trace.connection_name}" has an invalid wire`,
        )
      if (current && current.layer !== entry.layer)
        throw new Error(
          `PostProcessingSolver: immutable trace "${trace.connection_name}" changes layer without a transition`,
        )
      if (current)
        segments.push({
          start: current,
          end: entry,
          layer: entry.layer,
          width: Math.max(current.width, entry.width),
          connectionName: trace.connection_name,
          terminal: null,
        })
      current = entry
      continue
    }

    if (entry.route_type === "via") {
      const layers = getTransitionLayers(
        entry.from_layer,
        entry.to_layer,
        layerCount,
      )
      const currentAtVia = current as
        | (Point & { layer: string; width: number })
        | null
      const diameter: number | null =
        entry.via_diameter ?? currentAtVia?.width ?? inferredWidth
      if (
        !Number.isFinite(entry.x) ||
        !Number.isFinite(entry.y) ||
        layers.length < 2 ||
        diameter === null ||
        !Number.isFinite(diameter) ||
        diameter <= 0 ||
        (entry.via_hole_diameter !== undefined &&
          (!Number.isFinite(entry.via_hole_diameter) ||
            entry.via_hole_diameter <= 0 ||
            (diameter !== null && entry.via_hole_diameter >= diameter)))
      )
        throw new Error(
          `PostProcessingSolver: immutable trace "${trace.connection_name}" has an invalid via`,
        )
      if (
        currentAtVia &&
        Math.hypot(currentAtVia.x - entry.x, currentAtVia.y - entry.y) > 1e-8
      )
        segments.push({
          start: currentAtVia,
          end: entry,
          layer: currentAtVia.layer,
          width: currentAtVia.width,
          connectionName: trace.connection_name,
          terminal: null,
        })
      vias.push({
        x: entry.x,
        y: entry.y,
        layers,
        diameter,
        connectionName: trace.connection_name,
        terminal:
          index === 0
            ? "start"
            : index === trace.route.length - 1
              ? "end"
              : null,
      })
      const nextWire = trace.route
        .slice(index + 1)
        .find((candidate) => candidate.route_type === "wire")
      const nextLayer: string | null =
        currentAtVia?.layer === entry.from_layer
          ? entry.to_layer
          : currentAtVia?.layer === entry.to_layer
            ? entry.from_layer
            : nextWire?.route_type === "wire" &&
                (nextWire.layer === entry.from_layer ||
                  nextWire.layer === entry.to_layer)
              ? nextWire.layer
              : null
      if (!nextLayer)
        throw new Error(
          `PostProcessingSolver: immutable trace "${trace.connection_name}" has a discontinuous via`,
        )
      current = {
        x: entry.x,
        y: entry.y,
        layer: nextLayer,
        width: currentAtVia?.width ?? inferredWidth ?? diameter,
      }
      continue
    }

    if (entry.route_type === "jumper") {
      const width = jumperWidths[entry.footprint]
      if (
        !Number.isFinite(entry.start.x) ||
        !Number.isFinite(entry.start.y) ||
        !Number.isFinite(entry.end.x) ||
        !Number.isFinite(entry.end.y) ||
        getLayerIndex(entry.layer, layerCount) < 0
      )
        throw new Error(
          `PostProcessingSolver: immutable trace "${trace.connection_name}" has an invalid jumper`,
        )
      if (
        current &&
        (current.layer !== entry.layer ||
          Math.hypot(current.x - entry.start.x, current.y - entry.start.y) >
            1e-8)
      )
        throw new Error(
          `PostProcessingSolver: immutable trace "${trace.connection_name}" has a discontinuous jumper`,
        )
      segments.push({
        start: entry.start,
        end: entry.end,
        layer: entry.layer,
        width,
        connectionName: trace.connection_name,
        terminal: null,
      })
      current = { ...entry.end, layer: entry.layer, width }
      continue
    }

    const layers = getTransitionLayers(
      entry.from_layer,
      entry.to_layer,
      layerCount,
    )
    if (
      !Number.isFinite(entry.start.x) ||
      !Number.isFinite(entry.start.y) ||
      !Number.isFinite(entry.end.x) ||
      !Number.isFinite(entry.end.y) ||
      !Number.isFinite(entry.width) ||
      entry.width <= 0 ||
      layers.length < 2
    )
      throw new Error(
        `PostProcessingSolver: immutable trace "${trace.connection_name}" has invalid through-obstacle copper`,
      )
    if (
      current &&
      ((current.layer !== entry.from_layer &&
        current.layer !== entry.to_layer) ||
        Math.hypot(current.x - entry.start.x, current.y - entry.start.y) > 1e-8)
    )
      throw new Error(
        `PostProcessingSolver: immutable trace "${trace.connection_name}" has discontinuous through-obstacle copper`,
      )
    for (const layer of layers)
      segments.push({
        start: entry.start,
        end: entry.end,
        layer,
        width: entry.width,
        connectionName: trace.connection_name,
        terminal: null,
      })
    const currentAtTransition = current as
      | (Point & { layer: string; width: number })
      | null
    const nextLayer: string =
      currentAtTransition?.layer === entry.to_layer
        ? entry.from_layer
        : entry.to_layer
    current = { ...entry.end, layer: nextLayer, width: entry.width }
  }
  return { segments, vias }
}
