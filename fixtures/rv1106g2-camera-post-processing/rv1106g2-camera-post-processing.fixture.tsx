import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import {
  PostProcessingSolver,
  type PostProcessingSolverParams,
} from "../../lib"
import reproInput from "./rv1106g2-camera-post-processing.json"

export default function Rv1106g2CameraPostProcessingFixture(): React.JSX.Element {
  const createSolver = (): PostProcessingSolver => {
    // SAFETY: This captured solver input is also validated by the matching regression test.
    const params = reproInput as unknown as PostProcessingSolverParams
    return new PostProcessingSolver(params)
  }

  return <GenericSolverDebugger createSolver={createSolver} />
}
