import { readFileSync } from "node:fs"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import type { HighDensityRoute } from "../../lib/types"

type CapturedBoard = {
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  obstacles: Array<{
    center: { x: number; y: number }
    width: number
    height: number
    layers: string[]
    ccwRotationDegrees?: number
    shape?: string
  }>
}

/** Convert real two-layer SRJ/HD geometry (board mm, +X right, +Y up) to PCB elements. */
export function getUsbPcbCircuitJson(
  routes: HighDensityRoute[],
): AnyCircuitElement[] {
  const srj = JSON.parse(
    readFileSync(
      new URL("./ordered-usb-pair.srj.json", import.meta.url),
      "utf8",
    ),
  ) as CapturedBoard
  const artwork = JSON.parse(
    readFileSync(
      new URL("./ordered-usb-pair.artwork.json", import.meta.url),
      "utf8",
    ),
  ) as AnyCircuitElement[]
  const { minX, maxX, minY, maxY } = srj.bounds
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "usb",
      num_layers: 2,
      thickness: 1.6,
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      width: maxX - minX,
      height: maxY - minY,
      material: "fr4",
    },
    ...artwork,
  ]
  srj.obstacles.forEach((obstacle, index) => {
    circuitJson.push({
      type: "pcb_smtpad",
      pcb_smtpad_id: `pad_${index}`,
      layer: "top",
      x: obstacle.center.x,
      y: obstacle.center.y,
      ...(obstacle.shape === "circle"
        ? { shape: "circle", radius: obstacle.width / 2 }
        : {
            shape: "rotated_rect",
            width: obstacle.width,
            height: obstacle.height,
            ccw_rotation: obstacle.ccwRotationDegrees ?? 0,
          }),
    })
  })
  routes.forEach((route, index) => {
    const points: PcbTrace["route"] = []
    route.route.forEach((point, pointIndex) => {
      const previous = route.route[pointIndex - 1]
      if (previous && previous.z !== point.z)
        points.push({
          route_type: "via",
          x: point.x,
          y: point.y,
          from_layer: previous.z === 0 ? "top" : "bottom",
          to_layer: point.z === 0 ? "top" : "bottom",
        })
      points.push({
        route_type: "wire",
        x: point.x,
        y: point.y,
        width: point.traceThickness ?? route.traceThickness,
        layer: point.z === 0 ? "top" : "bottom",
      })
    })
    circuitJson.push({
      type: "pcb_trace",
      pcb_trace_id: `trace_${index}`,
      source_trace_id: route.rootConnectionName,
      route: points,
    })
    route.vias.forEach((via, viaIndex) =>
      circuitJson.push({
        type: "pcb_via",
        pcb_via_id: `via_${index}_${viaIndex}`,
        x: via.x,
        y: via.y,
        outer_diameter: route.viaDiameter,
        hole_diameter: route.viaDiameter / 2,
        layers: ["top", "bottom"],
      }),
    )
  })
  return circuitJson
}
