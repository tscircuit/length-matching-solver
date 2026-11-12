// A P-net test-point stub is not the missing J1 → ESD hop of a USB lane.
// Duplicate J1 → ESD hops are ambiguous and must also be rejected.
import { expect, test } from "bun:test"
import { findConnectionRouteIndexes } from "../lib/length-matching/connection/findConnectionRouteIndexes"
import { UsbEsdMcuSolver } from "./fixtures/UsbEsdMcuSolver"

test("ordered lanes reject a missing or ambiguous hop instead of using a root", (): void => {
  const routes = new UsbEsdMcuSolver().getConstructorParams()[0].hdRoutes
  const tap = routes.find((route) => route.connectionName === "tap")!
  const route = { ...tap, rootConnectionName: "P_AB" }
  expect(() => findConnectionRouteIndexes([route], ["P_AB"])).toThrow(
    'lane hop "P_AB" must identify exactly one route, got 0',
  )
  const hop = { ...route, connectionName: "P_AB" }
  expect(() => findConnectionRouteIndexes([hop, hop], ["P_AB"])).toThrow(
    'lane hop "P_AB" must identify exactly one route, got 2',
  )
})
