import type { GraphicsObject } from "graphics-debug"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib/length-matching-solver"
import type { HighDensityRoute } from "../../lib/types"

/** A small USB board: J1 → U1 ESD protection → U2 MCU, plus a P-net test point. */
export class UsbEsdMcuSolver extends LengthMatchingSolver {
  constructor(
    differentialPairs?: LengthMatchingSolverParams["differentialPairs"],
  ) {
    // Deliberately shuffled: lane order must come from the declared hop names.
    const routeDefinitions = [
      {
        connectionName: "P_BC",
        rootConnectionName: "P",
        route: [
          { x: 11, y: 0.5, z: 0, pcb_port_id: "U1.P_OUT" },
          { x: 24.5, y: 0.5, z: 0, pcb_port_id: "U2.USB_P" },
        ],
      },
      {
        connectionName: "tap",
        rootConnectionName: "P",
        route: [
          { x: 4, y: 0.5, z: 0, pcb_port_id: "P_AB.branch" },
          { x: 4, y: 3.5, z: 0, pcb_port_id: "TP1.P" },
        ],
      },
      {
        connectionName: "N_AB",
        rootConnectionName: "N",
        route: [
          { x: 1, y: -0.5, z: 0, pcb_port_id: "J1.D-" },
          { x: 9, y: -0.5, z: 0, pcb_port_id: "U1.N_IN" },
        ],
      },
      {
        connectionName: "P_AB",
        rootConnectionName: "P",
        route: [
          { x: 1, y: 0.5, z: 0, pcb_port_id: "J1.D+" },
          { x: 4, y: 0.5, z: 0 },
          { x: 9, y: 0.5, z: 0, pcb_port_id: "U1.P_IN" },
        ],
      },
      {
        connectionName: "N_BC",
        rootConnectionName: "N",
        route: [
          { x: 11, y: -0.5, z: 0, pcb_port_id: "U1.N_OUT" },
          { x: 13, y: -0.5, z: 0 },
          { x: 14.5, y: -2, z: 0 },
          { x: 21, y: -2, z: 0 },
          { x: 22.5, y: -0.5, z: 0 },
          { x: 24.5, y: -0.5, z: 0, pcb_port_id: "U2.USB_N" },
        ],
      },
    ]
    const hdRoutes: HighDensityRoute[] = routeDefinitions.map((route) => ({
      ...route,
      traceThickness: 0.15,
      viaDiameter: 0.6,
      vias: [],
    }))

    super({
      hdRoutes,
      originalConnections: hdRoutes.map((route) => ({
        name: route.connectionName,
        rootConnectionName: route.rootConnectionName,
        pointsToConnect: [route.route[0]!, route.route.at(-1)!].map(
          (point) => ({
            x: point.x,
            y: point.y,
            layer: "top",
            pcb_port_id: point.pcb_port_id,
          }),
        ),
      })),
      differentialPairs,
      bounds: { minX: -2, maxX: 28, minY: -5, maxY: 6 },
      maximumMeanderDepth: 2,
      layerCount: 2,
      colorMap: { P: "#c2410c", N: "#1d4ed8" },
      obstacles: [
        { center: { x: 0, y: 0 }, width: 1.2, height: 3 },
        { center: { x: 10, y: 0 }, width: 1.2, height: 2 },
        { center: { x: 26, y: 0 }, width: 2.2, height: 4 },
      ].map((body) => ({
        ...body,
        type: "rect",
        layers: ["top"],
        connectedTo: [],
      })),
    })
  }

  override visualize(): GraphicsObject {
    const graphics = super.visualize()
    const params = this.getConstructorParams()[0]
    const terminals = new Map(
      params.originalConnections.flatMap((connection) =>
        connection.pointsToConnect.map((point) => [point.pcb_port_id, point]),
      ),
    )
    // These are board annotations only; all trace geometry comes from the solver.
    return {
      ...graphics,
      points: [...terminals.values()].map((point) => ({
        x: point.x,
        y: point.y,
        color: "#475569",
      })),
      circles: [
        ...graphics.circles!,
        {
          center: { x: 4, y: 3.5 },
          radius: 0.4,
          fill: "#fef3c7",
          stroke: "#c2410c",
        },
      ],
      texts: [
        { x: 13, y: 5.2, text: "USB pair: J1 → ESD → MCU", fontSize: 0.8 },
        { x: 0, y: 2.5, text: "J1 / USB", fontSize: 0.6 },
        { x: 10, y: 2.5, text: "U1 / ESD", fontSize: 0.6 },
        { x: 26, y: 3, text: "U2 / MCU", fontSize: 0.6 },
        { x: 4, y: 4.2, text: "TP1 / ignored tap", fontSize: 0.55 },
        { x: 6.5, y: 1.3, text: "P_AB", color: "#c2410c", fontSize: 0.6 },
        { x: 5.5, y: -1.5, text: "N_AB", color: "#1d4ed8", fontSize: 0.6 },
        { x: 17, y: 2, text: "P_BC", color: "#c2410c", fontSize: 0.6 },
        { x: 17, y: -3, text: "N_BC", color: "#1d4ed8", fontSize: 0.6 },
        {
          x: 13,
          y: -4.3,
          text: this.solved
            ? "P gains length; TP1 stays outside the matched lane"
            : "N takes a longer path; tune P without counting TP1",
          fontSize: 0.55,
        },
      ],
    }
  }
}
