import type { DifferentialPairPath } from "../../types"

export function getFixedDifferentialPairPathTraceIds(
  paths: DifferentialPairPath[],
): Set<string> {
  const ids = new Set<string>()
  for (const path of paths) {
    for (const member of path.sections.flat()) {
      if ("pcbTraceId" in member) ids.add(member.pcbTraceId)
    }
  }
  return ids
}
