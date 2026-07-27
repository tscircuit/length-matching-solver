import {
  DifferentialPairRoutingSession,
  type DifferentialPairRoutingInput,
} from "./DifferentialPairRoutingSession"
import type { PairSolveResult } from "../model/internal-types"

/** Route one declared pair as an atomic coupled bundle. */
export const solveDifferentialPair = (
  input: DifferentialPairRoutingInput,
): PairSolveResult => {
  const session = new DifferentialPairRoutingSession(input)
  while (!session.isComplete()) session.step()
  return session.getResult()
}
