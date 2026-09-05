import type {
  DifferentialPair,
  HighDensityRoute,
  SimpleRouteConnection,
  SimplifiedPcbTraceViaRoutePoint,
  SimplifiedPcbTraces,
} from "../../types"
import type { LengthMatchingSolverParams } from "../../length-matching/types"
import { getLayerIndex } from "../geometry/getLayerIndex"
import { getTransitionLayers } from "../geometry/getTransitionLayers"
import { parseSimplifiedPcbTrace } from "../model/parseSimplifiedPcbTrace"
import { createImmutableCollisionRoutes } from "./createImmutableCollisionRoutes"
import { getLengthMatchingPairs } from "./getLengthMatchingPairs"
import type { FortyFiveDegreeSimplificationOutput } from "../solvers/FortyFiveDegreeSimplificationSolver"
import type { InternalPostProcessingParams } from "../types"

export type LengthMatchingTraceBinding = {
  traceIndex: number
  matchedRouteIndex: number
  viaTemplates: SimplifiedPcbTraceViaRoutePoint[]
  startEndpoint: { x: number; y: number; z: number }
  endEndpoint: { x: number; y: number; z: number }
  startPortId?: string
  endPortId?: string
}

export type LengthMatchingBinding = {
  solverParams: LengthMatchingSolverParams & {
    differentialPairs: DifferentialPair[]
  }
  traceBindings: LengthMatchingTraceBinding[]
  baseTraces: SimplifiedPcbTraces
}

/** Bind local simplified traces to the regular length-matching route model. */
export const createLengthMatchingBinding = (input: {
  result: FortyFiveDegreeSimplificationOutput
  params: InternalPostProcessingParams
}): LengthMatchingBinding => {
  const { simpleRouteJson } = input.params
  const differentialPairs = getLengthMatchingPairs({
    traces: input.result.traces,
    declaredPairs: simpleRouteJson.differentialPairs,
    reroutedPairs: input.result.reroutedPairs,
    layerCount: simpleRouteJson.layerCount,
  })
  const targetConnectionNames = new Set(
    differentialPairs.flatMap((pair) => pair.connectionNames),
  )
  const hdRoutes: HighDensityRoute[] = []
  const originalConnections: SimpleRouteConnection[] = []
  const traceBindings: LengthMatchingTraceBinding[] = []
  const convertedTargetNames = new Set<string>()

  for (
    let traceIndex = 0;
    traceIndex < input.result.traces.length;
    traceIndex++
  ) {
    const trace = input.result.traces[traceIndex]!
    if (!targetConnectionNames.has(trace.connection_name)) continue
    const onlyWireAndVia = trace.route.every(
      (entry) => entry.route_type === "wire" || entry.route_type === "via",
    )
    const startsWithWire = trace.route[0]?.route_type === "wire"
    if (!onlyWireAndVia || !startsWithWire) {
      throw new Error(
        `PostProcessingSolver: rerouted connection "${trace.connection_name}" cannot be bound to LengthMatchingSolver`,
      )
    }
    const parsed = parseSimplifiedPcbTrace(trace, simpleRouteJson.layerCount)
    const firstWire = trace.route[0]
    if (firstWire.route_type !== "wire")
      throw new Error(
        `PostProcessingSolver: trace "${trace.connection_name}" lost its first wire during binding`,
      )
    const route: HighDensityRoute["route"] = [
      {
        x: firstWire.x,
        y: firstWire.y,
        z: getLayerIndex(firstWire.layer, simpleRouteJson.layerCount),
        traceThickness: firstWire.width,
      },
    ]
    const vias: HighDensityRoute["vias"] = []
    const viaTemplates: SimplifiedPcbTraceViaRoutePoint[] = []
    let currentLayer = firstWire.layer
    let currentWidth = firstWire.width

    for (const entry of trace.route.slice(1)) {
      if (entry.route_type === "wire") {
        if (entry.layer !== currentLayer)
          throw new Error(
            `PostProcessingSolver: trace "${trace.connection_name}" changes layers without a via while binding`,
          )
        route.push({
          x: entry.x,
          y: entry.y,
          z: getLayerIndex(entry.layer, simpleRouteJson.layerCount),
          traceThickness: entry.width,
        })
        currentWidth = entry.width
        continue
      }
      if (entry.route_type !== "via")
        throw new Error(
          `PostProcessingSolver: trace "${trace.connection_name}" contains unsupported bound geometry`,
        )
      const nextLayer =
        currentLayer === entry.from_layer
          ? entry.to_layer
          : currentLayer === entry.to_layer
            ? entry.from_layer
            : null
      if (!nextLayer)
        throw new Error(
          `PostProcessingSolver: trace "${trace.connection_name}" has a discontinuous bound via`,
        )
      const current = route.at(-1)!
      if (Math.hypot(current.x - entry.x, current.y - entry.y) > 1e-8)
        route.push({
          x: entry.x,
          y: entry.y,
          z: getLayerIndex(currentLayer, simpleRouteJson.layerCount),
          traceThickness: currentWidth,
        })
      route.push({
        x: entry.x,
        y: entry.y,
        z: getLayerIndex(nextLayer, simpleRouteJson.layerCount),
        traceThickness: currentWidth,
      })
      vias.push({
        x: entry.x,
        y: entry.y,
        zLayers: getTransitionLayers(
          entry.from_layer,
          entry.to_layer,
          simpleRouteJson.layerCount,
        ).map((layer) => getLayerIndex(layer, simpleRouteJson.layerCount)),
      })
      viaTemplates.push({ ...entry })
      currentLayer = nextLayer
    }
    if (route.length < 2)
      throw new Error(
        `PostProcessingSolver: trace "${trace.connection_name}" has no bound copper segments`,
      )
    const maximumWidth = Math.max(
      ...route.map((point) => point.traceThickness ?? parsed.width),
    )
    const maximumViaDiameter = parsed.viaDiameter
    const matchedRouteIndex = hdRoutes.length
    hdRoutes.push({
      connectionName: trace.connection_name,
      traceThickness: maximumWidth,
      viaDiameter: maximumViaDiameter,
      route,
      vias,
    })
    const firstPoint = route[0]!
    const lastPoint = route.at(-1)!
    originalConnections.push({
      name: trace.connection_name,
      pointsToConnect: [
        {
          x: firstPoint.x,
          y: firstPoint.y,
          layer: firstWire.layer,
          ...(parsed.startPortId ? { pcb_port_id: parsed.startPortId } : {}),
        },
        {
          x: lastPoint.x,
          y: lastPoint.y,
          layer: parsed.points.at(-1)!.layer,
          ...(parsed.endPortId ? { pcb_port_id: parsed.endPortId } : {}),
        },
      ],
    })
    traceBindings.push({
      traceIndex,
      matchedRouteIndex,
      viaTemplates,
      startEndpoint: { ...firstPoint },
      endEndpoint: { ...lastPoint },
      ...(parsed.startPortId ? { startPortId: parsed.startPortId } : {}),
      ...(parsed.endPortId ? { endPortId: parsed.endPortId } : {}),
    })
    convertedTargetNames.add(trace.connection_name)
  }

  for (const connectionName of targetConnectionNames) {
    if (!convertedTargetNames.has(connectionName))
      throw new Error(
        `PostProcessingSolver: missing LengthMatchingSolver binding for rerouted connection "${connectionName}"`,
      )
  }

  for (const trace of input.result.traces) {
    if (targetConnectionNames.has(trace.connection_name)) continue
    hdRoutes.push(
      ...createImmutableCollisionRoutes(trace, simpleRouteJson.layerCount),
    )
  }
  const obstacleMargin =
    simpleRouteJson.minTraceToPadEdgeClearance ??
    Math.max(
      0,
      ...hdRoutes
        .filter((route) => route.route.length >= 2)
        .map((route) => route.traceThickness),
    )
  return {
    solverParams: {
      hdRoutes,
      originalConnections,
      differentialPairs,
      obstacles: simpleRouteJson.obstacles,
      bounds: simpleRouteJson.bounds,
      layerCount: simpleRouteJson.layerCount,
      obstacleMargin,
    },
    traceBindings,
    baseTraces: structuredClone(input.result.traces),
  }
}
