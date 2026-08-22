import { expect, test } from "bun:test"
import type { SimplifiedPcbTrace } from "../../../lib"
import { createLengthMatchingBinding } from "../../../lib/post-processing/binding/createLengthMatchingBinding"

test("keeps a declared differential pair eligible after coupled rerouting fails", () => {
  const traces: SimplifiedPcbTrace[] = [
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_p",
      connection_name: "P",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "p_start",
        },
        {
          route_type: "wire",
          x: 10,
          y: 0,
          width: 0.15,
          layer: "top",
          end_pcb_port_id: "p_end",
        },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_n",
      connection_name: "N",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 1,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "n_start",
        },
        {
          route_type: "wire",
          x: 14,
          y: 1,
          width: 0.15,
          layer: "top",
          end_pcb_port_id: "n_end",
        },
      ],
    },
  ]
  const differentialPair = {
    connectionNames: ["P", "N"] as [string, string],
    lengthTolerance: 0.05,
  }

  const binding = createLengthMatchingBinding({
    result: {
      traces,
      reroutedPairs: [],
    },
    params: {
      simpleRouteJson: {
        traces,
        differentialPairs: [differentialPair],
        obstacles: [],
        bounds: { minX: -1, maxX: 15, minY: -1, maxY: 2 },
        layerCount: 2,
      },
    },
  })

  expect(binding.solverParams.differentialPairs).toEqual([differentialPair])
  expect(binding.traceBindings).toHaveLength(2)
  expect(binding.solverParams.originalConnections).toHaveLength(2)
})
