import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { LengthMatchingSolver } from "../../lib"
import { crossLayerCenterlineCrash } from "./cross-layer-centerline-crash"

export default function CrossLayerCenterlineCrashFixture(): React.JSX.Element {
  return (
    <GenericSolverDebugger
      createSolver={() => new LengthMatchingSolver(crossLayerCenterlineCrash)}
    />
  )
}
