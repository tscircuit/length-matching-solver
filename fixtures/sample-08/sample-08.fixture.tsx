import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import type { LengthMatchingSolverParams } from "../../lib/length-matching-solver"
import { AlertingLengthMatchingSolver } from "../alerting-length-matching-solver"
import sampleProblem from "./sample-08.srj.json"

const createSolver = (): AlertingLengthMatchingSolver => {
  // SAFETY: This repository-owned JSON is exercised by the multi-segment regression test. The cast restores JSON literals widened by TypeScript module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  return new AlertingLengthMatchingSolver(params)
}

export default function LengthMatchingFixture(): React.JSX.Element {
  return <GenericSolverDebugger createSolver={createSolver} />
}
