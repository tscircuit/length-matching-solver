/** Indicates that valid input could not satisfy final routing constraints. */
export class PostProcessingConstraintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PostProcessingConstraintError"
  }
}
