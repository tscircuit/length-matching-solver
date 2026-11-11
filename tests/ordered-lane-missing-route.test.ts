import { expect, test } from "bun:test"
import { findConnectionRouteIndexes } from "../lib/length-matching/connection/findConnectionRouteIndexes"
import type { HighDensityRoute } from "../lib/types"

test("ordered lanes reject a missing or ambiguous hop instead of using a root", (): void => {
  const route: HighDensityRoute = {
    connectionName: "tap",
    rootConnectionName: "P_AB",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    route: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
    vias: [],
  }
  expect(() => findConnectionRouteIndexes([route], ["P_AB"])).toThrow(
    'lane hop "P_AB" must identify exactly one route, got 0',
  )
  const hop = { ...route, connectionName: "P_AB" }
  expect(() => findConnectionRouteIndexes([hop, hop], ["P_AB"])).toThrow(
    'lane hop "P_AB" must identify exactly one route, got 2',
  )
})
