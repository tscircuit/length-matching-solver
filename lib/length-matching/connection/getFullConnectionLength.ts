import type { ConnectionName, HighDensityRoute } from "../../types"
import { getConnectionLength } from "./getConnectionLength"

type FullConnectionLengthInput = {
  routes: HighDensityRoute[]
  routeIndexes: number[]
  connectionName: ConnectionName
  fixedLengthByConnectionName?: Readonly<
    Partial<Record<ConnectionName, number>>
  >
}

/** Add immutable copper once without exposing it as tunable route geometry. */
export const getFullConnectionLength = (
  input: FullConnectionLengthInput,
): number => {
  const routedLength = getConnectionLength(input.routes, input.routeIndexes)
  const offsets = input.fixedLengthByConnectionName
  if (!offsets || !Object.hasOwn(offsets, input.connectionName))
    return routedLength
  const fixedLength = offsets[input.connectionName]
  if (fixedLength === undefined)
    throw new Error(
      `LengthMatchingSolver: missing fixed length for connection "${input.connectionName}"`,
    )
  return routedLength + fixedLength
}
