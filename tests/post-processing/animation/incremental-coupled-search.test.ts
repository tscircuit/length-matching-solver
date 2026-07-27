import { expect, test } from "bun:test"
import sampleProblem from "../../../fixtures/sample-11/sample-11.srj.json"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../../lib"

const getPreviewSignature = (solver: PostProcessingSolver): string | null => {
  const previewLines =
    solver
      .visualize()
      .lines?.filter((line) => line.strokeColor === "#16a34a") ?? []
  return previewLines.length > 0 ? JSON.stringify(previewLines) : null
}

test("shows each coupled-path search expansion as a debugger frame", () => {
  // SAFETY: This repository-owned browser fixture contains a central obstacle that requires multiple A* expansions.
  const params = sampleProblem as unknown as PostProcessingSolverParams
  const solver = new PostProcessingSolver(params)
  const frames = new Set<string>()

  for (let index = 0; index < 100 && frames.size < 2; index++) {
    solver.step()
    const signature = getPreviewSignature(solver)
    if (signature) frames.add(signature)
  }

  expect(solver.solved).toBe(false)
  expect(frames.size).toBeGreaterThanOrEqual(2)
})
