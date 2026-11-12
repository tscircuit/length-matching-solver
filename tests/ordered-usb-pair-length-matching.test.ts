// Ordered lanes now exclude TP1, so D+ receives the matching meanders.
// The J1 → ESD → MCU lane lengths agree within the 0.1 mm tolerance.
import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getConnectionLength } from "../lib/length-matching/connection/getConnectionLength"
import { findConnectionRouteIndexes } from "../lib/length-matching/connection/findConnectionRouteIndexes"
import { getUsbPcbCircuitJson } from "./fixtures/getUsbPcbCircuitJson"
import { UsbEsdMcuSolver } from "./fixtures/UsbEsdMcuSolver"

test("snapshots the USB board after length matching", async (): Promise<void> => {
  const solver = new UsbEsdMcuSolver([
    {
      connectionNames: [
        ["P_AB", "P_BC"],
        ["N_AB", "N_BC"],
      ],
      lengthTolerance: 0.1,
    },
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
  expect(pLength).toBeCloseTo(21.64541962141149, 6)
  expect(nLength).toBeCloseTo(21.64541962141149, 6)
  expect(Math.abs(pLength - nLength)).toBeLessThanOrEqual(0.1)
  expect(after[0]).toEqual(before[0])
  expect(after[1]).toEqual(before[1])
  expect(after[3]).not.toEqual(before[3])
  expect(after[2]).toEqual(before[2])
  expect(after[4]).toEqual(before[4])
  expect(getConnectionLength(after, [3, 0])).toBeGreaterThan(
    getConnectionLength(before, [3, 0]),
  )
  const notes = [
    "length-matching-solver: adds meanders so both lanes of a differential pair end up the same length",
    "Lanes are now ordered hop lists: D+ = J1->ESD, ESD->MCU; TP1 is not counted.",
    "Meander goes on D+.",
    `Result: D+ ${pLength.toFixed(2)} mm, D- ${nLength.toFixed(2)} mm.`,
  ]
  await expect(
    convertCircuitJsonToPcbSvg(getUsbPcbCircuitJson(after, notes), {
      width: 1200,
      height: 975,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
