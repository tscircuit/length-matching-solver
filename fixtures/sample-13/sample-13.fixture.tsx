import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { PostProcessingSolver, type SimpleRouteJson } from "../../lib"
import sampleProblem from "./sample-13.srj.json"

export default function GridCrossingFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    const simpleRouteJson = sampleProblem as unknown as SimpleRouteJson
    return new PostProcessingSolver({ simpleRouteJson })
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
