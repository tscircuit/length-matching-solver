// A USB pair runs from J1 through an ESD chip to the MCU.
// N takes a longer path; the P-net test-point stub must not count toward P's lane.
import { expect, test } from "bun:test"
import { UsbEsdMcuSolver } from "./fixtures/UsbEsdMcuSolver"

test("shows the USB board before ordered-lane length matching", async () => {
  const solver = new UsbEsdMcuSolver()

  await expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
