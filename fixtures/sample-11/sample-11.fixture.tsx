import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { PostProcessingSolver, type SimpleRouteJson } from "../../lib"
import sampleProblem from "./sample-11.srj.json"

export default function CoupledObstacleDetourFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    // SAFETY: This repository-owned JSON is shared with the coupled-detour regression test. The cast restores JSON literals widened by module inference.
    const simpleRouteJson = sampleProblem as unknown as SimpleRouteJson
    return new PostProcessingSolver({ simpleRouteJson })
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
