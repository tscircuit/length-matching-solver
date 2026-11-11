import type { HighDensityRoute, SimpleRouteConnection } from "../../types"
import { findConnectionRouteIndexes } from "../connection-routes"
import { LengthMatchingConstraintError } from "../errors/LengthMatchingConstraintError"
import type { LengthMatchingPair } from "../types"
import { validateHopRoute } from "./validateHopRoute"

/** Validate exact owned hops and return the two complete lane memberships. */
export const validatePair = (
  pair: LengthMatchingPair,
  originalConnections: SimpleRouteConnection[],
  routes: HighDensityRoute[],
  layerCount: number,
  pairIndex: number,
): [number[], number[]] => {
  const fail = (message: string): never => {
    throw new LengthMatchingConstraintError(pairIndex, "invalid-input", message)
  }
  if (!Number.isFinite(pair.maxLengthSkewMm) || pair.maxLengthSkewMm < 0)
    fail("maxLengthSkewMm must be a non-negative finite number")
  if (!Array.isArray(pair.connectionNames) || pair.connectionNames.length !== 2)
    fail("must declare exactly two nonempty hop lists")
  for (const distance of [
    pair.minimumCenterlineDistance,
    pair.maximumCenterlineDistance,
  ])
    if (distance !== undefined && (!Number.isFinite(distance) || distance <= 0))
      fail("centerline distances must be positive finite numbers")
  if (
    pair.minimumCenterlineDistance !== undefined &&
    pair.maximumCenterlineDistance !== undefined &&
    pair.minimumCenterlineDistance > pair.maximumCenterlineDistance
  )
    fail("minimumCenterlineDistance cannot exceed maximumCenterlineDistance")

  const seen = new Set<string>()
  const indexes: [number[], number[]] = [[], []]
  for (const [laneIndex, names] of pair.connectionNames.entries()) {
    if (!Array.isArray(names) || names.length === 0)
      fail(`lane ${laneIndex} must be a nonempty hop list`)
    for (const name of names) {
      if (typeof name !== "string" || name.length === 0 || seen.has(name))
        fail(`invalid or duplicate hop name "${name}"`)
      seen.add(name)
      const connections = originalConnections.filter(
        (connection): boolean => connection.name === name,
      )
      if (connections.length !== 1)
        fail(`hop "${name}" must resolve to exactly one original connection`)
      const connection = connections[0]!
      if (connection.pointsToConnect.length !== 2)
        fail(
          `connection "${name}" must have exactly two points before MST splitting`,
        )
      const routeIndexes = findConnectionRouteIndexes(routes, name)
      if (routeIndexes.length !== 1)
        throw new LengthMatchingConstraintError(
          pairIndex,
          "incomplete-route",
          routeIndexes.length === 0
            ? `missing route for connection "${name}"`
            : `connection "${name}" must have exactly one complete route; stitch fragments before matching`,
        )
      validateHopRoute(
        routes[routeIndexes[0]!]!,
        connection,
        layerCount,
        pairIndex,
      )
      indexes[laneIndex]!.push(routeIndexes[0]!)
    }
  }
  return indexes
}
