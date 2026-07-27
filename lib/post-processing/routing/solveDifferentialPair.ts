import {
  DifferentialPairRoutingSession,
  type DifferentialPairRoutingInput,
} from "./DifferentialPairRoutingSession"
import type { PairSolveResult } from "../model/internal-types"

/** Route and finally length-match one declared pair as an atomic bundle. */
export const solveDifferentialPair = (
  input: DifferentialPairRoutingInput,
): PairSolveResult => {
  const session = new DifferentialPairRoutingSession(input)
  while (!session.isComplete()) session.step()
  return session.getResult()
}
