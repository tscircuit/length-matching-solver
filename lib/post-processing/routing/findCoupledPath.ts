import { IncrementalCoupledPathSearch } from "./IncrementalCoupledPathSearch"
import type { CoupledPathPoint, CoupledPathSearchInput } from "./types"

/** Find a deterministic layered A* path for a common differential-pair spine. */
export const findCoupledPath = (
  input: CoupledPathSearchInput,
): CoupledPathPoint[] | null => {
  const search = new IncrementalCoupledPathSearch(input)
  while (!search.isComplete()) search.step()
  return search.getPath()
}
