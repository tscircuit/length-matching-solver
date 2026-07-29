import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { PostProcessingSolver } from "../../lib"
import {
  createPostProcessingParamsFromSimpleRouteJson,
  type PostProcessingSimpleRouteJsonFixture,
} from "../createPostProcessingParamsFromSimpleRouteJson"
import sampleProblem from "./sample-13.srj.json"

export default function GridCrossingFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    const params = createPostProcessingParamsFromSimpleRouteJson(
      sampleProblem as unknown as PostProcessingSimpleRouteJsonFixture,
    )
    return new PostProcessingSolver(params)
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
