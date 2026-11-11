import { getTraceCopperGeometry } from "../../post-processing/model/getTraceCopperGeometry"
import { getRouteLength } from "../../route-geometry"
import type {
  DifferentialPairPath,
  HighDensityRoute,
  SimplifiedPcbTraces,
} from "../../types"

/** Measure all declared sections and identify the routes that can be tuned. */
export function resolveDifferentialPairPath(
  pair: DifferentialPairPath,
  routes: HighDensityRoute[],
  traces: SimplifiedPcbTraces,
  layerCount: number,
): {
  routeIndexes: [number[], number[]]
  lengths: [number, number]
} {
  const routeIndexes: [number[], number[]] = [[], []]
  const lengths: [number, number] = [0, 0]
  const seenRoutes = new Set<number>()
  const seenTraces = new Set<string>()
  if (!Array.isArray(pair.sections) || pair.sections.length === 0)
    throw new Error("LengthMatchingSolver: differential path has no sections")
  for (const section of pair.sections) {
    if (!Array.isArray(section) || section.length !== 2)
      throw new Error("LengthMatchingSolver: invalid differential path section")
    for (const lane of [0, 1] as const) {
      const member = section[lane]
      if (!member || typeof member !== "object")
        throw new Error(
          "LengthMatchingSolver: invalid differential path member",
        )
      if ("connectionName" in member) {
        const indexes = routes.flatMap((route, index) =>
          route.connectionName === member.connectionName ? [index] : [],
        )
        if (indexes.length !== 1 || seenRoutes.has(indexes[0]!))
          throw new Error(
            `LengthMatchingSolver: differential path section "${member.connectionName}" must identify one distinct routed connection`,
          )
        const index = indexes[0]!
        seenRoutes.add(index)
        routeIndexes[lane].push(index)
        lengths[lane] += getRouteLength(routes[index]!)
      } else {
        const matches = traces.filter(
          (trace) => trace.pcb_trace_id === member.pcbTraceId,
        )
        if (matches.length !== 1 || seenTraces.has(member.pcbTraceId))
          throw new Error(
            `LengthMatchingSolver: differential path section "${member.pcbTraceId}" must identify one distinct preloaded trace`,
          )
        seenTraces.add(member.pcbTraceId)
        const { segments, vias } = getTraceCopperGeometry(
          matches[0]!,
          layerCount,
        )
        if (segments.length === 0 && vias.length === 0)
          throw new Error(
            `LengthMatchingSolver: differential path trace "${member.pcbTraceId}" has no copper`,
          )
        for (const { start, end } of segments) {
          lengths[lane] += Math.hypot(end.x - start.x, end.y - start.y)
        }
      }
    }
  }
  return { routeIndexes, lengths }
}
