import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import type { LengthMatchingSolverParams } from "../../lib/length-matching-solver"
import { AlertingLengthMatchingSolver } from "../alerting-length-matching-solver"
import sampleProblem from "./sample-10.srj.json"

export default function SmallGapFixture(): React.JSX.Element {
  const createSolver = (): AlertingLengthMatchingSolver => {
    // SAFETY: This repository-owned JSON is an intentionally unsolved small-gap fixture. The cast restores JSON literals widened by TypeScript module inference.
    const params = sampleProblem as unknown as LengthMatchingSolverParams
    return new AlertingLengthMatchingSolver(params)
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
