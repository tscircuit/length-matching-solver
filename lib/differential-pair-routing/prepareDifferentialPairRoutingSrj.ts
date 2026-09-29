import type { DifferentialPairRoutingSrj } from "./types"

/** Let each connection leave its pads using the native SRJ net aliases. */
export function prepareDifferentialPairRoutingSrj<
  Srj extends DifferentialPairRoutingSrj,
>(srj: Srj): Srj {
  const routingSrj = structuredClone(srj)
  if (!routingSrj.differentialPairs?.length) return routingSrj
  for (const connection of routingSrj.connections) {
    const aliases = new Set([
      connection.name,
      connection.__netConnectionName,
      ...(connection.__rootConnectionNames ?? []),
      ...connection.pointsToConnect.flatMap((point) => [
        point.pcb_port_id,
        point.pointId,
      ]),
    ])
    for (const obstacle of routingSrj.obstacles) {
      if (!obstacle.connectedTo.some((name) => aliases.has(name))) continue
      if (!obstacle.connectedTo.includes(connection.name))
        obstacle.connectedTo.push(connection.name)
    }
  }
  return routingSrj
}
