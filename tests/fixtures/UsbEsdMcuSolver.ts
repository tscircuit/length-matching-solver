import { readFileSync } from "node:fs"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib/length-matching-solver"

// Real Pipeline 7 matcher input from core #5415's TSX board, with a D+ tap.
export class UsbEsdMcuSolver extends LengthMatchingSolver {
  constructor(
    differentialPairs?: LengthMatchingSolverParams["differentialPairs"],
  ) {
    const captured = JSON.parse(
      readFileSync(
        new URL("./ordered-usb-pair.matcher.json", import.meta.url),
        "utf8",
      ),
    ) as LengthMatchingSolverParams
    const [p, n] = captured.differentialPairs![0]!
      .connectionNames as unknown as [string[], string[]]
    const tap = captured.hdRoutes.find(
      (route) => ![...p, ...n].includes(route.connectionName),
    )!
    // Only rename and shuffle real routes to retain the original exact assertions.
    // Every coordinate, obstacle, width and via is preserved from the capture.
    const names = [
      ["P_BC", p[1], "P"],
      ["tap", tap.connectionName, "P"],
      ["N_AB", n[0], "N"],
      ["P_AB", p[0], "P"],
      ["N_BC", n[1], "N"],
    ]
    const hdRoutes = names.map(
      ([connectionName, actualName, rootConnectionName]) => ({
        ...captured.hdRoutes.find(
          (route) => route.connectionName === actualName,
        )!,
        connectionName: connectionName!,
        rootConnectionName,
      }),
    )
    const originalConnections = names.map(
      ([name, actualName, rootConnectionName]) => ({
        ...captured.originalConnections.find(
          (connection) => connection.name === actualName,
        )!,
        name: name!,
        rootConnectionName,
      }),
    )
    // Legacy root callers declare only the lane terminals, as bus pipelines do.
    for (const name of ["P", "N"]) {
      originalConnections.push({
        ...originalConnections.find(
          (connection) => connection.name === `${name}_AB`,
        )!,
        name,
        pointsToConnect: [
          originalConnections.find(
            (connection) => connection.name === `${name}_AB`,
          )!.pointsToConnect[0]!,
          originalConnections.find(
            (connection) => connection.name === `${name}_BC`,
          )!.pointsToConnect[1]!,
        ],
      })
    }
    super({ ...captured, hdRoutes, originalConnections, differentialPairs })
  }
}
