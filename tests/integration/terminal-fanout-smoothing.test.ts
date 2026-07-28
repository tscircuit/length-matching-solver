import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-14/sample-14.srj.json"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
  type SimplifiedPcbTrace,
} from "../../lib"

const getTerminalInteriorAngles = (
  trace: SimplifiedPcbTrace,
): [number, number] => {
  const wires = trace.route.filter((entry) => entry.route_type === "wire")
  const [startTerminal, startCorner, startTrunk] = wires
  const [endTrunk, endCorner, endTerminal] = wires.slice(-3)
  if (
    !startTerminal ||
    !startCorner ||
    !startTrunk ||
    !endTrunk ||
    !endCorner ||
    !endTerminal
  )
    throw new Error(`Expected three wire stations for ${trace.connection_name}`)
  const startIncoming = {
    x: startTerminal.x - startCorner.x,
    y: startTerminal.y - startCorner.y,
  }
  const startOutgoing = {
    x: startTrunk.x - startCorner.x,
    y: startTrunk.y - startCorner.y,
  }
  const endIncoming = {
    x: endTerminal.x - endCorner.x,
    y: endTerminal.y - endCorner.y,
  }
  const endOutgoing = {
    x: endTrunk.x - endCorner.x,
    y: endTrunk.y - endCorner.y,
  }
  return [
    (Math.acos(
      (startIncoming.x * startOutgoing.x +
        startIncoming.y * startOutgoing.y) /
        (Math.hypot(startIncoming.x, startIncoming.y) *
          Math.hypot(startOutgoing.x, startOutgoing.y)),
    ) *
      180) /
      Math.PI,
    (Math.acos(
      (endIncoming.x * endOutgoing.x + endIncoming.y * endOutgoing.y) /
        (Math.hypot(endIncoming.x, endIncoming.y) *
          Math.hypot(endOutgoing.x, endOutgoing.y)),
    ) *
      180) /
      Math.PI,
  ]
}

test("keeps port-selector differential-pair terminal joins at 125 degrees", () => {
  const solver = new PostProcessingSolver(
    sampleProblem as unknown as PostProcessingSolverParams,
  )
  solver.solve()

  const output = solver.getOutput()
  expect(output.errors).toHaveLength(0)
  for (const trace of output.traces) {
    const [startAngle, endAngle] = getTerminalInteriorAngles(trace)
    expect(startAngle).toBeGreaterThanOrEqual(125)
    expect(endAngle).toBeGreaterThanOrEqual(135)
  }
  const testPointTrace = output.traces.find(
    (trace) => trace.connection_name === "source_trace_0",
  )
  if (!testPointTrace) throw new Error("Expected the TP1 source trace")
  expect(
    testPointTrace.route.filter((entry) => entry.route_type === "wire"),
  ).toHaveLength(4)
  expect(solver.finalVisualize()).toMatchGraphicsSvg(import.meta.path)
})
