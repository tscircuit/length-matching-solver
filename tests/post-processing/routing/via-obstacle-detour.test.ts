import { expect, test } from "bun:test"
import sampleProblem from "../../../fixtures/sample-12/sample-12.srj.json"
import { PostProcessingSolver, type PostProcessingSolverParams } from "../../../lib"

// The coupled search currently rejects this geometry. Remove `.failing` when it can route the sample.
test.failing("reroutes a differential pair with paired via transitions around a component", () => {
  // SAFETY: This repository-owned JSON is shared with the Cosmos fixture. The cast restores literal discriminants widened by JSON module inference.
  const params = sampleProblem as unknown as PostProcessingSolverParams
  for (const trace of params.traces) {
    for (let index = 1; index < trace.route.length - 1; index++) {
      const via = trace.route[index]
      if (via?.route_type !== "via") continue
      const incoming = trace.route[index - 1]
      const outgoing = trace.route[index + 1]
      expect(incoming?.route_type).toBe("wire")
      expect(outgoing?.route_type).toBe("wire")
      if (incoming?.route_type !== "wire" || outgoing?.route_type !== "wire")
        throw new Error(`Expected ${trace.connection_name} via to be between wires`)
      expect(incoming).toMatchObject({
        x: via.x,
        y: via.y,
        layer: via.from_layer,
      })
      expect(outgoing.layer).toBe(via.to_layer)
    }
  }
  const solver = new PostProcessingSolver(params)

  solver.solve()

  const output = solver.getOutput()
  expect(output.errors).toHaveLength(0)
  const viaTransitions = output.traces.map((trace) =>
    trace.route
      .filter((entry) => entry.route_type === "via")
      .map((via) => `${via.from_layer}/${via.to_layer}`),
  )
  expect(viaTransitions).toEqual([
    ["top/bottom", "bottom/top"],
    ["top/bottom", "bottom/top"],
  ])
})
