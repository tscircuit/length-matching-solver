import { expect, test } from "bun:test"
import sampleProblem from "../../fixtures/sample-08/sample-08.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../../lib"
import { createMeanderCandidates } from "../../lib/length-matching/meander-candidate"
import { getRouteLength } from "../../lib/route-geometry"

test("matches a route using one consistent multi-segment meander style", () => {
  // SAFETY: This repository-owned JSON is the shared test and Cosmos fixture input. The cast restores literal tuple and obstacle discriminants widened by JSON module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  const candidates = createMeanderCandidates({
    routes: params.hdRoutes,
    routeIndexes: [1],
    maximumDepth: sampleProblem.maximumMeanderDepth,
    minimumToothPitch: params.minimumToothPitch,
    minMeanderGap: sampleProblem.minMeanderGap,
    maxToothCount: 8,
  })
  expect(
    new Set(candidates.map((candidate) => candidate.segmentIndex)),
  ).toEqual(new Set([0, 1, 2, 3, 4]))

  const solver = new LengthMatchingSolver(params)
  solver.solve()

  expect(solver.solved).toBe(true)
  const originalRoute = params.hdRoutes[1]!.route
  const matchedRoute = solver.matchedHdRoutes[1]!.route
  const originalPointIndexes = originalRoute.map((originalPoint) =>
    matchedRoute.findIndex(
      (matchedPoint) =>
        matchedPoint.x === originalPoint.x &&
        matchedPoint.y === originalPoint.y &&
        matchedPoint.z === originalPoint.z,
    ),
  )
  expect(originalPointIndexes.every((index) => index >= 0)).toBe(true)
  const matchedSegmentPointCounts = originalPointIndexes
    .slice(1)
    .map(
      (pointIndex, segmentIndex) =>
        pointIndex - originalPointIndexes[segmentIndex]!,
    )
  const modifiedSegmentPointCounts = matchedSegmentPointCounts.filter(
    (count) => count > 1,
  )
  expect(modifiedSegmentPointCounts).toHaveLength(2)
  expect(new Set(modifiedSegmentPointCounts).size).toBe(1)
  const tunedSegmentIndexes = matchedSegmentPointCounts.flatMap(
    (pointCount, segmentIndex) => (pointCount > 1 ? [segmentIndex] : []),
  )
  for (const segmentIndex of tunedSegmentIndexes) {
    const start = originalRoute[segmentIndex]!
    const end = originalRoute[segmentIndex + 1]!
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y)
    const normal = {
      x: -(end.y - start.y) / segmentLength,
      y: (end.x - start.x) / segmentLength,
    }
    const signedOffsets = matchedRoute
      .slice(
        originalPointIndexes[segmentIndex],
        originalPointIndexes[segmentIndex + 1]! + 1,
      )
      .map(
        (point) =>
          (point.x - start.x) * normal.x + (point.y - start.y) * normal.y,
      )
    const lobePeaks = signedOffsets.filter(
      (offset, pointIndex, offsets) =>
        Math.abs(offset) > 0.0001 &&
        Math.abs(offset) >= Math.abs(offsets[pointIndex - 1] ?? 0) &&
        Math.abs(offset) >= Math.abs(offsets[pointIndex + 1] ?? 0),
    )
    expect(lobePeaks).toHaveLength(3)
    expect(lobePeaks.every((offset) => offset < 0)).toBe(true)
    expect(lobePeaks[1]!).toBeLessThan(lobePeaks[0]!)
    expect(lobePeaks[0]).toBeCloseTo(lobePeaks[2]!, 6)
  }
  expect(
    Math.abs(
      getRouteLength(solver.matchedHdRoutes[1]!) -
        getRouteLength(solver.matchedHdRoutes[0]!),
    ),
  ).toBeLessThanOrEqual(params.differentialPairs![0]!.lengthTolerance)
})
