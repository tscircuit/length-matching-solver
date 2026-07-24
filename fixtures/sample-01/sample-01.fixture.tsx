import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import type { LengthMatchingSolverParams } from "../../lib/length-matching-solver"
import { AlertingLengthMatchingSolver } from "../alerting-length-matching-solver"
import sampleProblem from "./sample-01.srj.json"

export default function LengthMatchingFixture(): React.JSX.Element {
  const createSolver = (): AlertingLengthMatchingSolver => {
    // SAFETY: This repository-owned JSON is checked by TypeScript at both consumers and exercised by the solver test. The cast restores literal tuple and obstacle discriminants widened by JSON module inference.
    const params = sampleProblem as unknown as LengthMatchingSolverParams
    return new AlertingLengthMatchingSolver(params)
  }
  return <GenericSolverDebugger createSolver={createSolver} />
}
