import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { parseSimplifiedPcbTrace } from "../../../lib/post-processing/model/parseSimplifiedPcbTrace"
import { createCoupledPairCandidate } from "../../../lib/post-processing/routing/createCoupledPairCandidate"

test("preserves a coupled candidate that starts with a layer transition", () => {
  const positive: SimplifiedPcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "positive-trace",
    connection_name: "positive",
    route: [
      { route_type: "wire", x: 0, y: 0.5, width: 0.1, layer: "top" },
      {
        route_type: "via",
        x: 0,
        y: 0.5,
        from_layer: "top",
        to_layer: "bottom",
        via_diameter: 0.35,
      },
      { route_type: "wire", x: 0, y: 0.5, width: 0.1, layer: "bottom" },
      { route_type: "wire", x: 2, y: 0.5, width: 0.1, layer: "bottom" },
    ],
  }
  const negative: SimplifiedPcbTrace = {
    ...positive,
    pcb_trace_id: "negative-trace",
    connection_name: "negative",
    route: positive.route.map((point) => ({ ...point, y: -0.5 })),
  }
  const candidate = createCoupledPairCandidate({
    first: parseSimplifiedPcbTrace(positive, 6),
    second: parseSimplifiedPcbTrace(negative, 6),
    reverseSecond: false,
    path: [
      { x: 0, y: 0, layer: "top" },
      { x: 0, y: 0, layer: "bottom" },
      { x: 2, y: 0, layer: "bottom" },
    ],
    centerlineSpacing: 1,
    edgeGap: 0.9,
    side: 1,
    layerCount: 6,
    terminalFanout: false,
  })
  expect(candidate?.firstParsed.vias).toHaveLength(1)
  expect(candidate?.secondParsed.vias).toHaveLength(1)
  expect(candidate?.firstParsed.vias[0]?.layers).toEqual([
    "top",
    "inner1",
    "inner2",
    "inner3",
    "inner4",
    "bottom",
  ])
})
