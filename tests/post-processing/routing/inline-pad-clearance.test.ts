import { expect, test } from "bun:test"
import { isPathJoinClear } from "../../../lib/post-processing/geometry/isPathJoinClear"
import type { CopperSegment } from "../../../lib/post-processing/model/internal-types"
import type { DifferentialPairPathJoin } from "../../../lib/post-processing/routing/getDifferentialPairTerminalAlignment"

test("allows a declared terminal join while rejecting overlap along the same lane", () => {
  const terminal = { x: 4, y: 0 }
  const pathJoins: DifferentialPairPathJoin[] = [
    { connectionNames: ["P0", "P1"], point: terminal },
  ]
  const first: CopperSegment = {
    start: { x: 0, y: 0 },
    end: terminal,
    width: 0.15,
    layer: "top",
    connectionName: "P0",
    terminal: "end",
  }
  const neighbor: CopperSegment = {
    ...first,
    start: terminal,
    end: { x: 8, y: 0 },
    connectionName: "P1",
    terminal: "start",
  }
  expect(isPathJoinClear(pathJoins, first, neighbor, 0.3)).toBe(true)
  expect(
    isPathJoinClear(
      pathJoins,
      first,
      { ...neighbor, end: { x: 2, y: 0 } },
      0.3,
    ),
  ).toBe(false)
})
