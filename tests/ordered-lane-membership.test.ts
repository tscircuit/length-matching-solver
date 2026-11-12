// On main root lookup returns P_BC, TP1, P_AB instead of the ordered lane.
// Exact J1 → ESD → MCU hop lists are not accepted.
import { expect, test } from "bun:test"
import { getConnectionLength } from "../lib/length-matching/connection/getConnectionLength"
import { findConnectionRouteIndexes } from "../lib/length-matching/connection/findConnectionRouteIndexes"
import { UsbEsdMcuSolver } from "./fixtures/UsbEsdMcuSolver"

test.failing(
  "ordered lanes select exact hops without their same-root tap",
  (): void => {
    const solver = new UsbEsdMcuSolver([
      {
        connectionNames: [
          // @ts-expect-error Reproduction: main only accepts one string per lane.
          ["P_AB", "P_BC"],
          // @ts-expect-error Reproduction: main only accepts one string per lane.
          ["N_AB", "N_BC"],
        ],
        lengthTolerance: 0.1,
      },
    ])
    const params = solver.getConstructorParams()[0]
    const routes = params.hdRoutes
    // Strings retain the existing root-based lookup used by buses.
    expect(findConnectionRouteIndexes(routes, "P")).toEqual([0, 1, 3])
    // @ts-expect-error Reproduction: main cannot carry an ordered lane.
    const pLaneIndexes = findConnectionRouteIndexes(routes, ["P_AB", "P_BC"])
    expect(pLaneIndexes).toEqual([3, 0])
    // @ts-expect-error Reproduction: main cannot carry an ordered lane.
    const nLaneIndexes = findConnectionRouteIndexes(routes, ["N_AB", "N_BC"])
    expect(nLaneIndexes).toEqual([2, 4])
    solver.step()
    expect(solver.failed).toBe(false)
    expect<unknown>(params.differentialPairs![0]!.connectionNames).toEqual([
      ["P_AB", "P_BC"],
      ["N_AB", "N_BC"],
    ])

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.failed).toBe(false)
    const originalPLength = getConnectionLength(routes, pLaneIndexes)
    const matchedPLength = getConnectionLength(
      solver.matchedHdRoutes,
      pLaneIndexes,
    )
    const matchedNLength = getConnectionLength(
      solver.matchedHdRoutes,
      nLaneIndexes,
    )
    expect(matchedPLength).toBeGreaterThan(originalPLength)
    expect(Math.abs(matchedPLength - matchedNLength)).toBeLessThanOrEqual(
      params.differentialPairs![0]!.lengthTolerance,
    )
    const originalTap = routes.find((route) => route.connectionName === "tap")
    const matchedTap = solver.matchedHdRoutes.find(
      (route) => route.connectionName === "tap",
    )
    expect(matchedTap).toEqual(originalTap)
  },
)
