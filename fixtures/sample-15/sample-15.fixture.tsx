import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import type { LengthMatchingSolverParams } from "../../lib/length-matching-solver"
import { AlertingLengthMatchingSolver } from "../alerting-length-matching-solver"
import sampleProblem from "./sample-15.srj.json"

export default function ShortSegmentDualMeanderFixture(): React.JSX.Element {
  const createSolver = (): AlertingLengthMatchingSolver => {
    // SAFETY: This repository-owned JSON reproduces the short-segment dual-meander regression. The cast restores JSON literals widened by TypeScript module inference.
    const params = sampleProblem as unknown as LengthMatchingSolverParams
    return new AlertingLengthMatchingSolver(params)
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
