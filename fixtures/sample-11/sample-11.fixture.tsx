import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import type { PostProcessingSolverParams } from "../../lib"
import { PostProcessingSolver } from "../../lib"
import sampleProblem from "./sample-11.srj.json"

export default function CoupledObstacleDetourFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    // SAFETY: This repository-owned JSON is shared with the coupled-detour regression test. The cast restores JSON literals widened by module inference.
    const params = sampleProblem as unknown as PostProcessingSolverParams
    return new PostProcessingSolver(params)
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
