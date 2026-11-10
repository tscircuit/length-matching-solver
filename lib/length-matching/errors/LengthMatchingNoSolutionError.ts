/** Indicates that valid input could not be improved within its constraints. */
export class LengthMatchingNoSolutionError extends Error {
  readonly pairIndex?: number
  readonly connectionNames?: string[]
  readonly connectionName: string
  readonly reason: "no-meander-candidate" | "meander-search-exhausted"

  constructor(input: {
    message: string
    pairIndex?: number
    connectionNames?: string[]
    connectionName: string
    reason: "no-meander-candidate" | "meander-search-exhausted"
  }) {
    super(input.message)
    this.name = "LengthMatchingNoSolutionError"
    this.pairIndex = input.pairIndex
    this.connectionNames = input.connectionNames
    this.connectionName = input.connectionName
    this.reason = input.reason
  }
}
