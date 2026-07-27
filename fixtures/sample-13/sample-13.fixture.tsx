import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../lib"
import sampleProblem from "./sample-13.srj.json"

export default function GridCrossingFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    const params = sampleProblem as unknown as PostProcessingSolverParams
    return new PostProcessingSolver(params)
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
