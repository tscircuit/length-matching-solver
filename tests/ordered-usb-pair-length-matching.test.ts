// On main root lookup counts TP1 as D+, so D- gets the meanders instead of D+.
// The actual two-hop lanes finish 5.583 mm apart despite a 0.1 mm tolerance.
import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getConnectionLength } from "../lib/length-matching/connection/getConnectionLength"
import { findConnectionRouteIndexes } from "../lib/length-matching/connection/findConnectionRouteIndexes"
import { getUsbPcbCircuitJson } from "./fixtures/getUsbPcbCircuitJson"
import { UsbEsdMcuSolver } from "./fixtures/UsbEsdMcuSolver"

test("snapshots the USB board after length matching", async (): Promise<void> => {
  const solver = new UsbEsdMcuSolver([
    { connectionNames: ["P", "N"], lengthTolerance: 0.1 },
  ])
  const before = solver.getConstructorParams()[0].hdRoutes
  expect(findConnectionRouteIndexes(before, "P")).toEqual([0, 1, 3])
  expect([0, 1, 3].map((index) => before[index]!.connectionName)).toEqual([
    "P_BC",
    "tap",
    "P_AB",
  ])
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const after = solver.matchedHdRoutes
  const pLength = getConnectionLength(after, [3, 0])
  const nLength = getConnectionLength(after, [2, 4])
  expect(pLength).toBeCloseTo(20.41408729652601, 6)
  expect(nLength).toBeCloseTo(25.99667747704034, 6)
  expect(getConnectionLength(after, [0, 1, 3])).toBeCloseTo(nLength, 6)
  expect(after[1]).toEqual(before[1])
  expect(getConnectionLength(after, [2])).toBeCloseTo(15.802882979747778, 6)
  expect(getConnectionLength(after, [4])).toBeCloseTo(10.193794497292561, 6)
  expect(after[2]).not.toEqual(before[2])
  expect(after[4]).not.toEqual(before[4])
  console.log("USB lane lengths (mm):", {
    pLength,
    nLength,
    tapLength: getConnectionLength(after, [1]),
  })
  await expect(
    convertCircuitJsonToPcbSvg(getUsbPcbCircuitJson(after)),
  ).toMatchSvgSnapshot(import.meta.path)
})
