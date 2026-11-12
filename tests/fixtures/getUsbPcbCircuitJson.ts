import { readFileSync } from "node:fs"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import type { HighDensityRoute } from "../../lib/types"

type CapturedBoard = {
  connections: Array<{ name: string }>
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  obstacles: Array<{
    center: { x: number; y: number }
    width: number
    height: number
    layers: string[]
    ccwRotationDegrees?: number
    circuitJsonMetadata?: { pcb_port_id?: string }
    shape?: string
  }>
}

/** Convert real two-layer SRJ/HD geometry (board mm, +X right, +Y up) to PCB elements. */
export function getUsbPcbCircuitJson(
  routes: HighDensityRoute[],
  notes: string[],
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
  const connectivity = JSON.parse(
    readFileSync(
      new URL("./ordered-usb-pair.connectivity.json", import.meta.url),
      "utf8",
    ),
  ) as AnyCircuitElement[]
  const roots: Record<string, string> = {
    P: srj.connections[0]!.name,
    N: srj.connections[1]!.name,
  }
  const { minX, maxX, minY, maxY } = srj.bounds
  // Extend only the rendered board above the captured copper for native notes.
  const noteHeight = 6
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "usb",
      num_layers: 2,
      thickness: 1.6,
      center: { x: (minX + maxX) / 2, y: (minY + maxY + noteHeight) / 2 },
      width: maxX - minX,
      height: maxY - minY + noteHeight,
      material: "fr4",
    },
    ...artwork,
    ...connectivity,
  ]
  notes.forEach((text, index) => {
    circuitJson.push({
      type: "pcb_fabrication_note_text",
      pcb_fabrication_note_text_id: `usb_note_${index}`,
      pcb_component_id: "pcb_component_0",
      font: "tscircuit2024",
      font_size: 0.5,
      text,
      layer: "top",
      color: "#ffffff",
      anchor_alignment: "center",
      anchor_position: {
        x: (minX + maxX) / 2,
        y: maxY + noteHeight - 0.8 - index * 1.1,
      },
    })
  })
  srj.obstacles.forEach((obstacle, index) => {
    circuitJson.push({
      type: "pcb_smtpad",
      pcb_smtpad_id: `pad_${index}`,
      pcb_port_id: obstacle.circuitJsonMetadata?.pcb_port_id,
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
      source_trace_id: roots[route.rootConnectionName!],
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
