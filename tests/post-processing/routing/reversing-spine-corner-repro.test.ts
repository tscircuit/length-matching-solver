import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { parseSimplifiedPcbTrace } from "../../../lib/post-processing/model/parseSimplifiedPcbTrace"
import { createCoupledPairCandidate } from "../../../lib/post-processing/routing/createCoupledPairCandidate"
import type { CoupledPathPoint } from "../../../lib/post-processing/routing/types"

const createParsedTrace = (
  id: string,
  name: string,
  start: CoupledPathPoint,
  end: CoupledPathPoint,
) => {
  const route: SimplifiedPcbTrace["route"] = [
    { route_type: "wire", ...start, width: 0.16 },
    { route_type: "wire", ...end, width: 0.16 },
  ]
  return parseSimplifiedPcbTrace(
    {
      type: "pcb_trace",
      pcb_trace_id: id,
      connection_name: name,
      route,
    },
    4,
  )
}

test("reproduces the RV1106G2 reversing differential-pair spine crash", () => {
  const path: CoupledPathPoint[] = [
    { x: 0, y: 0, layer: "top" },
    { x: 2, y: 0, layer: "top" },
    { x: 1, y: 0, layer: "top" },
    { x: 1, y: 2, layer: "top" },
  ]
  const first = createParsedTrace(
    "camera-p",
    "CSI_D0_P",
    { x: 0, y: 0.135, layer: "top" },
    { x: 0.865, y: 2, layer: "top" },
  )
  const second = createParsedTrace(
    "camera-n",
    "CSI_D0_N",
    { x: 0, y: -0.135, layer: "top" },
    { x: 1.135, y: 2, layer: "top" },
  )

  expect({
    lines: [
      {
        points: path.slice(0, 2),
        strokeColor: "#2563eb",
        strokeWidth: 0.16,
        label: "incoming spine",
      },
      {
        points: path.slice(1, 3),
        strokeColor: "#dc2626",
        strokeWidth: 0.16,
        label: "180 degree reversal",
      },
      {
        points: path.slice(2),
        strokeColor: "#16a34a",
        strokeWidth: 0.16,
        label: "outgoing spine",
      },
    ],
    points: path.map((point, index) => ({
      ...point,
      label: `spine point ${index}`,
      color: "#111827",
    })),
  }).toMatchGraphicsSvg(import.meta.path)

  expect(() =>
    createCoupledPairCandidate({
      first,
      second,
      reverseSecond: false,
      path,
      centerlineSpacing: 0.27,
      edgeGap: 0.11,
      side: 1,
      layerCount: 4,
    }),
  ).toThrow("PostProcessingSolver: cannot offset a reversing spine corner")
})
