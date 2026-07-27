import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-11/sample-11.srj.json"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
  type SimplifiedPcbTrace,
} from "../../lib"

const getWireYAtX = (trace: SimplifiedPcbTrace, x: number): number => {
  for (let index = 0; index < trace.route.length - 1; index++) {
    const start = trace.route[index]
    const end = trace.route[index + 1]
    if (start?.route_type !== "wire" || end?.route_type !== "wire") continue
    if ((x - start.x) * (x - end.x) > 0 || start.x === end.x) continue
    const progress = (x - start.x) / (end.x - start.x)
    return start.y + (end.y - start.y) * progress
  }
  throw new Error(`Expected ${trace.connection_name} to cross x=${x}`)
}

test("reroutes an oppositely-detoured pair together around a component", () => {
  // SAFETY: This repository-owned JSON is the shared browser fixture input. The cast restores literal discriminants widened by JSON module inference.
  const params = sampleProblem as unknown as PostProcessingSolverParams
  const solver = new PostProcessingSolver(params)
  solver.solve()

  const output = solver.getOutput()
  expect(output.errors).toHaveLength(0)
  const [positive, negative] = output.traces
  if (!positive || !negative)
    throw new Error("Expected both differential-pair traces")

  const positiveY = getWireYAtX(positive, 5)
  const negativeY = getWireYAtX(negative, 5)
  expect(Math.sign(positiveY)).toBe(Math.sign(negativeY))
  expect(Math.abs(positiveY - negativeY)).toBeGreaterThanOrEqual(0.7 - 1e-7)
  expect(Math.abs(positiveY - negativeY)).toBeLessThanOrEqual(1.2 + 1e-7)
})
