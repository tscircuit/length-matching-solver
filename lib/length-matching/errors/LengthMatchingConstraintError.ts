/** Invalid membership, incomplete copper, or unmet final lane skew. */
export class LengthMatchingConstraintError extends Error {
  constructor(
    readonly pairIndex: number,
    readonly reason: "invalid-input" | "incomplete-route" | "unmet-skew",
    message: string,
  ) {
    super(`LengthMatchingSolver: pair ${pairIndex}: ${message}`)
    this.name = "LengthMatchingConstraintError"
  }
}
