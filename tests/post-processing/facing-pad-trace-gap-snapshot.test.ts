import { expect, test } from "bun:test"
import "bun-match-svg"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../lib"
import { getUsbInterfaceGapPcbCircuitJson } from "./fixtures/usb-interface-gap/getUsbInterfaceGapPcbCircuitJson"
import { getUsbInterfaceGapSamples } from "./fixtures/usb-interface-gap/getUsbInterfaceGapSamples"

test("replays the native USB interface gap capture", async (): Promise<void> => {
  const params: PostProcessingSolverParams = await Bun.file(
    new URL(
      "./fixtures/usb-interface-gap/post-processing.json",
      import.meta.url,
    ),
  ).json()
  const board: AnyCircuitElement[] = await Bun.file(
    new URL("./fixtures/usb-interface-gap/board.circuit.json", import.meta.url),
  ).json()
  const requestedGap = 0.3
  expect(params.hdRoutes).toHaveLength(2)
  expect(params.obstacles).toHaveLength(27)
  expect(params.differentialPairs[0]!.maxUncoupledLength).toBeUndefined()
  expect(params.differentialPairs[0]!.minimumCenterlineDistance).toBeCloseTo(
    0.45,
    8,
  )
  expect(params.differentialPairs[0]!.maximumCenterlineDistance).toBeCloseTo(
    0.45,
    8,
  )
  expect(
    board.filter((element) => element.type === "pcb_component"),
  ).toHaveLength(2)
  expect(board.filter((element) => element.type === "pcb_smtpad")).toHaveLength(
    23,
  )
  expect(
    board.filter((element) => element.type === "pcb_plated_hole"),
  ).toHaveLength(4)
  expect(board.filter((element) => element.type.endsWith("_error"))).toEqual([])

  const originalParams = structuredClone(params)
  const solver = new PostProcessingSolver(params)
  solver.solve()
  const output = solver.getOutput()
  expect(solver.solved).toBe(true)
  expect(output.postProcessingErrors).toEqual([])
  expect(params).toEqual(originalParams)
  expect(output.hdRoutes).toHaveLength(2)
  for (const trace of output.hdRoutes) {
    const original = params.hdRoutes.find(
      (candidate) => candidate.connectionName === trace.connectionName,
    )!
    expect(trace.route[0]).toMatchObject(original.route[0]!)
    expect(trace.route.at(-1)).toMatchObject(original.route.at(-1)!)
    expect(trace.traceThickness).toBe(0.15)
  }
  for (const gap of getUsbInterfaceGapSamples(output.hdRoutes)) {
    expect(gap).toBeCloseTo(requestedGap, 6)
  }
  await expect(
    convertCircuitJsonToPcbSvg(
      getUsbInterfaceGapPcbCircuitJson(board, output.hdRoutes),
      { width: 1200, height: 640 },
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})
