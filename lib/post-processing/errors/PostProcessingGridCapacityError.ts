/** Indicates that a valid board is too large for the bounded search grid. */
export class PostProcessingGridCapacityError extends Error {
  readonly reason = "grid-capacity-exhausted"

  constructor(message: string) {
    super(message)
    this.name = "PostProcessingGridCapacityError"
  }
}
