import { expect, test } from "bun:test"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../lib"
import { getUsbInterfaceGapSamples } from "./fixtures/usb-interface-gap/getUsbInterfaceGapSamples"

test("honors native USB gap", async (): Promise<void> => {
  const params: PostProcessingSolverParams = await Bun.file(
    new URL(
      "./fixtures/usb-interface-gap/post-processing.json",
      import.meta.url,
    ),
  ).json()
  const solver = new PostProcessingSolver(params)
  solver.solve()
  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  for (const gap of getUsbInterfaceGapSamples(output.hdRoutes)) {
    expect(gap).toBeCloseTo(0.3, 6)
  }
  expect(output.postProcessingErrors).toEqual([])
})
