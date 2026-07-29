import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../lib"
import { FortyFiveDegreeSimplificationSolver } from "../../lib/post-processing/solvers/FortyFiveDegreeSimplificationSolver"

test("simplifies farthest same-layer spans while preserving vias and endpoint metadata", () => {
  const createTrace = (
    connectionName: string,
    yOffset: number,
  ): SimplifiedPcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `trace_${connectionName}`,
    connection_name: connectionName,
    route: [
      {
        route_type: "wire",
        x: 0,
        y: 2 + yOffset,
        width: 0.2,
        layer: "top",
        start_pcb_port_id: `${connectionName}_start`,
      },
      { route_type: "wire", x: 1, y: 3 + yOffset, width: 0.2, layer: "top" },
      { route_type: "wire", x: 4, y: 3 + yOffset, width: 0.2, layer: "top" },
      { route_type: "wire", x: 6, y: 4 + yOffset, width: 0.2, layer: "top" },
      {
        route_type: "via",
        x: 6,
        y: 4 + yOffset,
        from_layer: "top",
        to_layer: "bottom",
        via_diameter: 0.5,
        via_hole_diameter: 0.2,
      },
      {
        route_type: "wire",
        x: 6,
        y: 4 + yOffset,
        width: 0.2,
        layer: "bottom",
      },
      {
        route_type: "wire",
        x: 8,
        y: 6 + yOffset,
        width: 0.2,
        layer: "bottom",
        end_pcb_port_id: `${connectionName}_end`,
      },
    ],
  })
  const traces = [createTrace("P", 0), createTrace("N", -1)]
  const solver = new FortyFiveDegreeSimplificationSolver({
    traces,
    reroutedPairs: [{ connectionNames: ["P", "N"], lengthTolerance: 0.01 }],
    obstacles: [],
    bounds: { minX: -1, maxX: 9, minY: 0, maxY: 7 },
    layerCount: 2,
  })
  solver.solve()
  const output = solver.getOutput()

  for (const trace of output.traces) {
    const via = trace.route.find((entry) => entry.route_type === "via")
    expect(via).toMatchObject({
      route_type: "via",
      x: 6,
      via_diameter: 0.5,
      via_hole_diameter: 0.2,
    })
    const wires = trace.route.filter((entry) => entry.route_type === "wire")
    expect(wires[0]?.start_pcb_port_id).toBe(`${trace.connection_name}_start`)
    expect(wires.at(-1)?.end_pcb_port_id).toBe(`${trace.connection_name}_end`)
    expect(
      wires.some(
        (wire) =>
          wire.x === 5 &&
          wire.y === 3 + (trace.connection_name === "P" ? 0 : -1),
      ),
    ).toBe(true)
    for (let index = 0; index < wires.length - 1; index++) {
      const start = wires[index]!
      const end = wires[index + 1]!
      if (start.layer !== end.layer) continue
      const dx = Math.abs(end.x - start.x)
      const dy = Math.abs(end.y - start.y)
      expect(dx < 1e-8 || dy < 1e-8 || Math.abs(dx - dy) < 1e-8).toBe(true)
    }
  }
})
