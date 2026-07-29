import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { PostProcessingSolver, type SimpleRouteJson } from "../../lib"
import sampleProblem from "./sample-12.srj.json"

export default function ViaObstacleDetourFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    // SAFETY: This repository-owned JSON is shared with the expected-failure via regression test. The cast restores literal discriminants widened by JSON module inference.
    const simpleRouteJson = sampleProblem as unknown as SimpleRouteJson
    return new PostProcessingSolver({ simpleRouteJson })
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
