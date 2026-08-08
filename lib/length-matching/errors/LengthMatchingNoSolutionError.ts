/** Indicates that valid input could not be improved within its constraints. */
export class LengthMatchingNoSolutionError extends Error {
  readonly connectionName: string
  readonly reason: "no-meander-candidate" | "meander-search-exhausted"

  constructor(input: {
    message: string
    connectionName: string
    reason: "no-meander-candidate" | "meander-search-exhausted"
  }) {
    super(input.message)
    this.name = "LengthMatchingNoSolutionError"
    this.connectionName = input.connectionName
    this.reason = input.reason
  }
}
