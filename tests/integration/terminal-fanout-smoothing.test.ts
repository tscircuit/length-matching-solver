import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-14/sample-14.srj.json"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
  type SimplifiedPcbTrace,
} from "../../lib"

const getFirstTerminalInteriorAngle = (trace: SimplifiedPcbTrace): number => {
  const wires = trace.route.filter((entry) => entry.route_type === "wire")
  const [terminal, corner, trunk] = wires
  if (!terminal || !corner || !trunk)
    throw new Error(`Expected three wire stations for ${trace.connection_name}`)
  const incoming = { x: terminal.x - corner.x, y: terminal.y - corner.y }
  const outgoing = { x: trunk.x - corner.x, y: trunk.y - corner.y }
  return (
    (Math.acos(
      (incoming.x * outgoing.x + incoming.y * outgoing.y) /
        (Math.hypot(incoming.x, incoming.y) *
          Math.hypot(outgoing.x, outgoing.y)),
    ) *
      180) /
    Math.PI
  )
}

test("preserves smooth terminal fanout joins from the port-selector differential pair", () => {
  const solver = new PostProcessingSolver(
    sampleProblem as unknown as PostProcessingSolverParams,
  )
  solver.solve()

  const output = solver.getOutput()
  expect(output.errors).toHaveLength(0)
  const testPointTrace = output.traces.find(
    (trace) => trace.connection_name === "source_trace_0",
  )
  if (!testPointTrace) throw new Error("Expected the TP1 source trace")
  expect(
    testPointTrace.route.filter((entry) => entry.route_type === "wire"),
  ).toHaveLength(4)
  expect(getFirstTerminalInteriorAngle(testPointTrace)).toBeGreaterThanOrEqual(
    125,
  )
})
