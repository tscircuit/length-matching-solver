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

test("keeps port-selector differential-pair terminal joins at 125 degrees", () => {
  const solver = new PostProcessingSolver(
    sampleProblem as unknown as PostProcessingSolverParams,
  )
  solver.solve()

  const output = solver.getOutput()
  expect(output.errors).toHaveLength(0)
  for (const trace of output.traces)
    expect(getFirstTerminalInteriorAngle(trace)).toBeGreaterThanOrEqual(125)
  const testPointTrace = output.traces.find(
    (trace) => trace.connection_name === "source_trace_0",
  )
  if (!testPointTrace) throw new Error("Expected the TP1 source trace")
  expect(
    testPointTrace.route.filter((entry) => entry.route_type === "wire"),
  ).toHaveLength(4)
  expect(solver.finalVisualize()).toMatchGraphicsSvg(import.meta.path)
})
