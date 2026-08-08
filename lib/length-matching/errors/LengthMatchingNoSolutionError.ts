/** Indicates that valid input could not be improved within its constraints. */
export class LengthMatchingNoSolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LengthMatchingNoSolutionError"
  }
}
