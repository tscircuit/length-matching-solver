import { getLayerName } from "../../post-processing/geometry/getLayerName"
import type {
  ConnectionPoint,
  HighDensityRoute,
  RoutePoint,
  SimpleRouteConnection,
} from "../../types"
import { LengthMatchingConstraintError } from "../errors/LengthMatchingConstraintError"

/** Require one complete polyline anchored to the declared hop terminals. */
export const validateHopRoute = (
  route: HighDensityRoute,
  connection: SimpleRouteConnection,
  layerCount: number,
  pairIndex: number,
): void => {
  const fail = (message: string): never => {
    throw new LengthMatchingConstraintError(
      pairIndex,
      "incomplete-route",
      `connection "${connection.name}" ${message}`,
    )
  }
  if (route.route.length < 2) fail("has no complete route")
  if (route.jumpers?.length) fail("contains unsupported jumper copper")
  for (const [index, point] of route.route.entries()) {
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isInteger(point.z) ||
      point.z < 0 ||
      point.z >= layerCount ||
      point.insideJumperPad ||
      point.toNextSegmentType
    )
      fail("has invalid or unsupported route geometry")
    const previous = route.route[index - 1]
    if (
      previous &&
      previous.z !== point.z &&
      (
        Math.hypot(previous.x - point.x, previous.y - point.y) > 1e-8 ||
        !route.vias.some((via): boolean =>
          Math.hypot(via.x - point.x, via.y - point.y) <= 1e-8 &&
          (via.zLayers === undefined ||
            (via.zLayers.includes(previous.z) && via.zLayers.includes(point.z))),
        )
      )
    )
      fail("has a discontinuous layer transition")
  }
  const matchesEndpoint = (
    point: RoutePoint,
    endpoint: ConnectionPoint,
  ): boolean => {
    const layers = "layer" in endpoint ? [endpoint.layer] : endpoint.layers
    return (
      Math.hypot(point.x - endpoint.x, point.y - endpoint.y) <= 1e-8 &&
      layers.includes(getLayerName(point.z, layerCount))
    )
  }
  const first = route.route[0]!
  const last = route.route.at(-1)!
  const [start, end] = connection.pointsToConnect
  if (
    !(
      (matchesEndpoint(first, start!) && matchesEndpoint(last, end!)) ||
      (matchesEndpoint(first, end!) && matchesEndpoint(last, start!))
    )
  )
    fail("does not cover its declared endpoints")
}
