import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import type { PostProcessingSolverParams } from "../../lib"
import { PostProcessingSolver } from "../../lib"
import sampleProblem from "./sample-12.srj.json"

export default function ViaObstacleDetourFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    // SAFETY: This repository-owned JSON is shared with the expected-failure via regression test. The cast restores literal discriminants widened by JSON module inference.
    const params = sampleProblem as unknown as PostProcessingSolverParams
    return new PostProcessingSolver(params)
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
