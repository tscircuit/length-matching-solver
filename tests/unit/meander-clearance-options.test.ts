import { expect, test } from "bun:test"
import { validateAndResolveParams } from "../../lib/length-matching/config"
import { createMeanderCandidates } from "../../lib/length-matching/meander-candidate"
import type { HighDensityRoute } from "../../lib/types"

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
    traceThickness?: number
    minMeanderGap?: number
    minMeanderHeight?: number
  }) =>
    createMeanderCandidates({
      routes: [
        {
          ...route,
          traceThickness: options.traceThickness ?? route.traceThickness,
        },
      ],
      routeIndexes: [0],
      maximumDepth: 2,
      maxToothCount: 1,
      minMeanderGap: options.minMeanderGap,
      minMeanderHeight: options.minMeanderHeight,
    })

  const defaultHeightCandidates = createCandidates({})
  const wideTraceCandidates = createCandidates({ traceThickness: 0.2 })
  const explicitNarrowGapCandidates = createCandidates({
    traceThickness: 0.2,
    minMeanderGap: 0.1,
  })
  const overriddenCandidates = createCandidates({
    minMeanderGap: 0.4,
    minMeanderHeight: 0.9,
  })

  expect(defaultHeightCandidates[0]?.toothPitch).toBeCloseTo(5)
  expect(
    defaultHeightCandidates.some(
      (candidate) => Math.abs(candidate.toothPitch - Math.sqrt(0.9 * 5)) < 1e-9,
    ),
  ).toBe(true)
  expect(
    defaultHeightCandidates.some(
      (candidate) => Math.abs(candidate.toothPitch - 0.9) < 1e-9,
    ),
  ).toBe(true)
  expect(defaultHeightCandidates[0]?.minimumHeight).toBeCloseTo(0.45)
  expect(
    wideTraceCandidates.some(
      (candidate) => Math.abs(candidate.toothPitch - 1.2) < 1e-9,
    ),
  ).toBe(true)
  expect(wideTraceCandidates[0]?.minimumHeight).toBeCloseTo(0.6)
  expect(
    explicitNarrowGapCandidates.some(
      (candidate) => Math.abs(candidate.toothPitch - 0.6) < 1e-9,
    ),
  ).toBe(true)
  expect(
    overriddenCandidates.some(
      (candidate) =>
        Math.abs(candidate.toothPitch - 1.1) < 1e-9 &&
        Math.abs(candidate.minimumHeight - 0.9) < 1e-9,
    ),
  ).toBe(true)
  expect(defaultConfig.minMeanderGap).toBeUndefined()
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
