import type { DifferentialPairPostProcessingSolverParams } from "../../lib"

export const getDifferentialPairTestParams = ({
  positiveEndLayer = "top",
  negativeEndLayer = positiveEndLayer,
  obstacles = [],
  viaOuterDiameter = 0.1,
  viaHoleDiameter = 0.05,
}: {
  positiveEndLayer?: string
  negativeEndLayer?: string
  obstacles?: Array<{
    obstacle_id: string
    type: "rect"
    layers: string[]
    center: { x: number; y: number }
    width: number
    height: number
  }>
  viaOuterDiameter?: number
  viaHoleDiameter?: number
} = {}): DifferentialPairPostProcessingSolverParams =>
  ({
    pcbTraces: [
      {
        pcb_trace_id: "pcb_trace_positive",
        source_trace_id: "source_trace_positive",
        route: [
          {
            route_type: "wire",
            x: -5,
            y: 0.15,
            width: 0.1,
            layer: "top",
          },
          {
            route_type: "wire",
            x: 5,
            y: 0.15,
            width: 0.1,
            layer: positiveEndLayer,
          },
        ],
      },
      {
        pcb_trace_id: "pcb_trace_negative",
        source_trace_id: "source_trace_negative",
        route: [
          {
            route_type: "wire",
            x: -5,
            y: -0.15,
            width: 0.1,
            layer: "top",
          },
          {
            route_type: "wire",
            x: 5,
            y: -0.15,
            width: 0.1,
            layer: negativeEndLayer,
          },
        ],
      },
    ],
    pcbVias: [],
    differentialPairs: [
      {
        name: "USB",
        positiveSourceTraceId: "source_trace_positive",
        negativeSourceTraceId: "source_trace_negative",
        maxLengthSkew: 0.01,
      },
    ],
    obstacles,
    board: { minX: -7, maxX: 7, minY: -5, maxY: 5 },
    designRules: {
      traceToTraceClearance: 0.05,
      traceToObstacleClearance: 0.1,
      viaToTraceClearance: 0.05,
      viaToObstacleClearance: 0.1,
      boardEdgeClearance: 0.1,
      viaHoleDiameter,
      viaOuterDiameter,
    },
    layerCount: 2,
  }) as unknown as DifferentialPairPostProcessingSolverParams
