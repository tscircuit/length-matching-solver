import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { PostProcessingSolver } from "../../lib"
import {
  createPostProcessingParamsFromSimpleRouteJson,
  type PostProcessingSimpleRouteJsonFixture,
} from "../createPostProcessingParamsFromSimpleRouteJson"
import sampleProblem from "./sample-12.srj.json"

export default function ViaObstacleDetourFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    // SAFETY: This repository-owned legacy SRJ is adapted to the flat HD API at the fixture edge.
    const params = createPostProcessingParamsFromSimpleRouteJson(
      sampleProblem as unknown as PostProcessingSimpleRouteJsonFixture,
    )
    return new PostProcessingSolver(params)
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
