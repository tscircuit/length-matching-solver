/** Indicates that valid input could not satisfy final routing constraints. */
export class PostProcessingConstraintError extends Error {
  readonly connectionNames: readonly [string, string]
  readonly reason: "length-tolerance-unsatisfied" | "invalid-final-copper"

  constructor(input: {
    message: string
    connectionNames: [string, string]
    reason: "length-tolerance-unsatisfied" | "invalid-final-copper"
  }) {
    super(input.message)
    this.name = "PostProcessingConstraintError"
    this.connectionNames = [...input.connectionNames]
    this.reason = input.reason
  }
}
