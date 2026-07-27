import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { getTraceCopperGeometry } from "../../../lib/post-processing/model/getTraceCopperGeometry"

test("models jumper pads and advances special immutable-copper geometry", () => {
  const trace: SimplifiedPcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "special",
    connection_name: "OTHER",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: 1, y: 0, width: 0.2, layer: "top" },
      {
        route_type: "jumper",
        start: { x: 1, y: 0 },
        end: { x: 3, y: 0 },
        footprint: "1206",
        layer: "top",
      },
      { route_type: "wire", x: 4, y: 0, width: 0.2, layer: "top" },
      {
        route_type: "through_obstacle",
        start: { x: 4, y: 0 },
        end: { x: 5, y: 0 },
        from_layer: "top",
        to_layer: "bottom",
        width: 0.3,
      },
      { route_type: "wire", x: 6, y: 0, width: 0.2, layer: "bottom" },
    ],
  }
  const copper = getTraceCopperGeometry(trace, 2)
  const jumper = copper.segments.find(
    (segment) => segment.start.x === 1 && segment.end.x === 3,
  )
  expect(jumper?.width).toBe(1.8)
  expect(
    copper.segments.some(
      (segment) => segment.start.x === 3 && segment.end.x === 4,
    ),
  ).toBe(true)
  expect(
    copper.segments.some(
      (segment) => segment.start.x === 1 && segment.end.x === 4,
    ),
  ).toBe(false)
  expect(
    copper.segments
      .filter((segment) => segment.start.x === 4 && segment.end.x === 5)
      .map((segment) => segment.layer)
      .sort(),
  ).toEqual(["bottom", "top"])
  expect(
    copper.segments.some(
      (segment) =>
        segment.start.x === 5 &&
        segment.end.x === 6 &&
        segment.layer === "bottom",
    ),
  ).toBe(true)

  const discontinuous: SimplifiedPcbTrace = {
    ...trace,
    route: trace.route.map((entry, index) =>
      index === 2 && entry.route_type === "jumper"
        ? { ...entry, start: { x: 1.1, y: 0 } }
        : entry,
    ),
  }
  expect(() => getTraceCopperGeometry(discontinuous, 2)).toThrow(
    /discontinuous jumper/,
  )
})
