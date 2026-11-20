import { expect, test } from "bun:test"
import type { Obstacle, SimplifiedPcbTrace } from "../../../lib"
import { DifferentialPairRoutingSession } from "../../../lib/post-processing/routing/DifferentialPairRoutingSession"
import { createPostProcessingVisualization } from "../../../lib/post-processing/visualization/createPostProcessingVisualization"

test("snapshots the selected copper gap between staggered pads", async () => {
  const terminals = [
    { connectionName: "CAM_P", y: 0.3, endX: 14 },
    { connectionName: "CAM_N", y: -0.3, endX: 9 },
  ]
  const startX = -14
  const traceWidth = 0.15
  const requestedGap = 0.25
  const centerlineSpacing = requestedGap + traceWidth
  const layerCount = 4
  const bounds = { minX: -22.5, maxX: 22.5, minY: -12, maxY: 12 }

  const traces: SimplifiedPcbTrace[] = terminals.map(
    ({ connectionName, y, endX }) => ({
      type: "pcb_trace",
      pcb_trace_id: connectionName,
      connection_name: connectionName,
      route: [startX, endX].map((x) => ({
        route_type: "wire",
        x,
        y,
        width: traceWidth,
        layer: "top",
      })),
    }),
  )
  const obstacles: Obstacle[] = terminals.flatMap(
    ({ connectionName, y, endX }) =>
      [startX, endX].map((x) => ({
        type: "rect",
        center: { x, y },
        width: 0.8,
        height: 0.25,
        layers: ["top"],
        connectedTo: [connectionName],
      })),
  )
  const session = new DifferentialPairRoutingSession({
    pair: {
      connectionNames: ["CAM_P", "CAM_N"],
      lengthTolerance: 0.05,
      minimumCenterlineDistance: centerlineSpacing,
      maximumCenterlineDistance: centerlineSpacing,
    },
    traces,
    obstacles,
    bounds,
    layerCount,
    minTraceToPadEdgeClearance: 0.1,
  })

  while (!session.isComplete()) session.step()
  const { candidate } = session.getResult()
  const graphics = createPostProcessingVisualization({
    traces: [candidate.first, candidate.second],
    obstacles,
    bounds,
    layerCount,
    activeConnectionNames: null,
    previewPath: null,
  })
  graphics.texts = [
    {
      x: 0,
      y: 4,
      text: `Copper gap ${candidate.edgeGap.toFixed(2)} mm (requested ${requestedGap.toFixed(2)} mm)`,
      fontSize: 1,
    },
  ]
  await expect(graphics).toMatchGraphicsSvg(import.meta.path, {
    backgroundColor: "white",
  })
})
