import type { HighDensityRoute, SimplifiedPcbTrace } from "../../types"
import { getLayerIndex } from "../geometry/getLayerIndex"
import { getTraceCopperGeometry } from "../model/getTraceCopperGeometry"

/** Convert immutable simplified-trace copper into collision-only matcher routes. */
export const createImmutableCollisionRoutes = (
  trace: SimplifiedPcbTrace,
  layerCount: number,
): HighDensityRoute[] => {
  const copper = getTraceCopperGeometry(trace, layerCount)
  const segmentRoutes: HighDensityRoute[] = copper.segments.map(
    (segment, index) => ({
      connectionName: `${trace.connection_name}#immutable-segment-${index}`,
      rootConnectionName: trace.connection_name,
      traceThickness: segment.width,
      viaDiameter: segment.width,
      route: [
        {
          x: segment.start.x,
          y: segment.start.y,
          z: getLayerIndex(segment.layer, layerCount),
          traceThickness: segment.width,
        },
        {
          x: segment.end.x,
          y: segment.end.y,
          z: getLayerIndex(segment.layer, layerCount),
          traceThickness: segment.width,
        },
      ],
      vias: [],
    }),
  )
  const viaRoutes: HighDensityRoute[] = copper.vias.map((via, index) => ({
    connectionName: `${trace.connection_name}#immutable-via-${index}`,
    rootConnectionName: trace.connection_name,
    traceThickness: via.diameter,
    viaDiameter: via.diameter,
    route: [],
    vias: [
      {
        x: via.x,
        y: via.y,
        zLayers: via.layers.map((layer) => getLayerIndex(layer, layerCount)),
      },
    ],
  }))
  return [...segmentRoutes, ...viaRoutes]
}
