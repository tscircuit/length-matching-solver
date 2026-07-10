import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import {
  LengthMatchingSolver,
  type LengthMatchingSolverParams,
} from "../../lib/length-matching-solver"
import sampleProblem from "./sample-02.srj.json"

const createSolver = (): LengthMatchingSolver => {
  // SAFETY: This repository-owned JSON is checked by TypeScript at both consumers and exercised by the solver test. The cast restores literal tuple and obstacle discriminants widened by JSON module inference.
  const params = sampleProblem as unknown as LengthMatchingSolverParams
  return new LengthMatchingSolver(params)
}

export default function LengthMatchingFixture(): React.JSX.Element {
  return <GenericSolverDebugger createSolver={createSolver} />
}
