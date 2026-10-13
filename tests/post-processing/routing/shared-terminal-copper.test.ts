import { expect, test } from "bun:test"
import { canJoinAtSharedTerminal } from "../../../lib/post-processing/geometry/canJoinAtSharedTerminal"
import type { CopperSegment } from "../../../lib/post-processing/model/internal-types"

test("rejects overlapping terminal exits on the same logical connection", () => {
  const first: CopperSegment = {
    connectionName: "a",
    start: { x: -1, y: 0 },
    end: { x: 0, y: 0 },
    width: 0.15,
    layer: "top",
    terminal: "end",
  }
  const second: CopperSegment = {
    connectionName: "b",
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    width: 0.15,
    layer: "top",
    terminal: "start",
  }
  const roots = new Map([
    ["a", "signal"],
    ["b", "signal"],
    ["c", "other"],
  ])
  expect(
    canJoinAtSharedTerminal(
      [first, { ...second, end: { x: -1, y: 0 } }],
      roots,
    ),
  ).toBe(false)
})
