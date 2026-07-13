import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-08/sample-08.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { createMeanderCandidates } from "../lib/length-matching/meander-candidate"
import { getRouteLength } from "../lib/route-geometry"

test("matches a route by distributing added length across multiple segments", () => {
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
  expect(modifiedSegmentPointCounts).toHaveLength(3)
  expect(new Set(modifiedSegmentPointCounts).size).toBe(1)
  expect(
    Math.abs(
      getRouteLength(solver.matchedHdRoutes[1]!) -
        getRouteLength(solver.matchedHdRoutes[0]!),
    ),
  ).toBeLessThanOrEqual(params.differentialPairs![0]!.lengthTolerance)
})
