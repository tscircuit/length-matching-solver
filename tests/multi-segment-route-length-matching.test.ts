import { expect, test } from "bun:test"
import sampleProblem from "../fixtures/sample-08/sample-08.srj.json"
import { LengthMatchingSolver, type LengthMatchingSolverParams } from "../lib"
import { createMeanderCandidates } from "../lib/length-matching/meander-candidate"

test("rejects a match that requires distributing added length across small segments", () => {
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

  expect(() => new LengthMatchingSolver(params).solve()).toThrow(
    'LengthMatchingSolver: linear regression exhausted all segment/tooth combinations for "multi_segment_n"',
  )
})
