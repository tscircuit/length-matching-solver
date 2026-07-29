import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { PostProcessingSolver, type SimpleRouteJson } from "../../lib"
import sampleProblem from "./sample-14.srj.json"

export default function TerminalFanoutSmoothingFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    const { routingGrid, ...routeJson } = sampleProblem
    const simpleRouteJson = routeJson as unknown as SimpleRouteJson
    return new PostProcessingSolver({ simpleRouteJson, routingGrid })
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
