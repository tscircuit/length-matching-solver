import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { PostProcessingSolver } from "../../lib"
import {
  createPostProcessingParamsFromSimpleRouteJson,
  type PostProcessingSimpleRouteJsonFixture,
} from "../createPostProcessingParamsFromSimpleRouteJson"
import sampleProblem from "./sample-14.srj.json"

export default function TerminalFanoutSmoothingFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    const { routingGrid, ...routeJson } = sampleProblem
    const params = createPostProcessingParamsFromSimpleRouteJson(
      routeJson as unknown as PostProcessingSimpleRouteJsonFixture,
      routingGrid,
    )
    return new PostProcessingSolver(params)
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
