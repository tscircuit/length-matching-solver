import type { PostProcessingSolverParams } from "../types"

/** Validate run-wide inputs; pair-specific infeasibility is handled during stepping. */
export const validatePostProcessingParams = (
  params: PostProcessingSolverParams,
): void => {
  if (!Array.isArray(params.traces) || !Array.isArray(params.differentialPairs))
    throw new Error("PostProcessingSolver: traces and differentialPairs must be arrays")
  if (!Array.isArray(params.obstacles))
    throw new Error("PostProcessingSolver: obstacles must be an array")
  if (!Number.isInteger(params.layerCount) || params.layerCount < 1)
    throw new Error("PostProcessingSolver: layerCount must be a positive integer")
  const { minX, maxX, minY, maxY } = params.bounds
  if (
    ![minX, maxX, minY, maxY].every(Number.isFinite) ||
    minX >= maxX ||
    minY >= maxY
  )
    throw new Error("PostProcessingSolver: bounds must have finite positive extents")
  const declaredConnections = new Set<string>()
  for (const pair of params.differentialPairs) {
    if (
      pair.connectionNames.length !== 2 ||
      pair.connectionNames[0] === pair.connectionNames[1] ||
      !pair.connectionNames.every((name) => typeof name === "string" && name.length > 0) ||
      !Number.isFinite(pair.lengthTolerance) ||
      pair.lengthTolerance < 0
    )
      throw new Error("PostProcessingSolver: differential pair declaration is invalid")
    for (const connectionName of pair.connectionNames) {
      if (declaredConnections.has(connectionName))
        throw new Error(
          `PostProcessingSolver: connection "${connectionName}" belongs to multiple differential pairs`,
        )
      declaredConnections.add(connectionName)
    }
  }
}
