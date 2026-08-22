import { expect, test } from "bun:test"
import { crossLayerCenterlineCrash } from "../../fixtures/cross-layer-centerline-crash/cross-layer-centerline-crash"
import { LengthMatchingSolver } from "../../lib"

test("reproduces a centerline measurement crash before a later same-layer candidate", () => {
  const solver = new LengthMatchingSolver(crossLayerCenterlineCrash)

  expect(() => solver.solve()).toThrow(
    "LengthMatchingSolver: cannot measure meander centerline distance without paired same-layer geometry",
  )
  expect(solver.solved).toBe(false)
  expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})
