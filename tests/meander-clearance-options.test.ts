import { expect, test } from "bun:test"
import { validateAndResolveParams } from "../lib/length-matching/config"
import { createMeanderCandidates } from "../lib/length-matching/meander-candidate"
import type { HighDensityRoute } from "../lib/types"

test("derives meander clearance defaults from trace width and accepts overrides", () => {
  const defaultConfig = validateAndResolveParams({
    hdRoutes: [],
    originalConnections: [],
  })
  const route: HighDensityRoute = {
    connectionName: "short-route",
    traceThickness: 0.15,
    viaDiameter: 0.6,
    vias: [],
    route: [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ],
  }
  const createCandidates = (options: {
    minMeanderGap: number
    minMeanderHeight?: number
  }) =>
    createMeanderCandidates({
      routes: [route],
      routeIndexes: [0],
      maximumDepth: 2,
      maxToothCount: 1,
      minMeanderGap: options.minMeanderGap,
      minMeanderHeight: options.minMeanderHeight,
    })

  const defaultHeightCandidates = createCandidates({ minMeanderGap: 0.25 })
  const overriddenCandidates = createCandidates({
    minMeanderGap: 0.4,
    minMeanderHeight: 0.9,
  })

  expect(defaultHeightCandidates[0]).toMatchObject({
    toothPitch: 0.8,
    minimumHeight: 0.4,
  })
  expect(overriddenCandidates[0]).toMatchObject({
    toothPitch: 1.1,
    minimumHeight: 0.9,
  })
  expect(defaultConfig.minMeanderGap).toBe(0.25)
  expect(() =>
    validateAndResolveParams({
      hdRoutes: [],
      originalConnections: [],
      minMeanderGap: 0,
    }),
  ).toThrow("minMeanderGap must be a positive finite number")
  expect(() =>
    validateAndResolveParams({
      hdRoutes: [],
      originalConnections: [],
      maximumMeanderDepth: 0.5,
      minMeanderHeight: 0.6,
    }),
  ).toThrow("minMeanderHeight cannot exceed maximumMeanderDepth")
})
