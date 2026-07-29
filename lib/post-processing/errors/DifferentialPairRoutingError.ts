export type DifferentialPairRoutingFailureReason =
  | "trace-resolution-failure"
  | "invalid-routed-geometry"
  | "terminal-layer-mismatch"
  | "coincident-terminal-midpoints"
  | "no-valid-candidate"

/** Identifies a declared differential pair that could not be rerouted. */
export class DifferentialPairRoutingError extends Error {
  readonly connectionNames: readonly [string, string]
  readonly reason: DifferentialPairRoutingFailureReason

  constructor(input: {
    connectionNames: [string, string]
    reason: DifferentialPairRoutingFailureReason
    message: string
  }) {
    super(
      `PostProcessingSolver: differential pair ${input.connectionNames.join("/")} ${input.message}`,
    )
    this.name = "DifferentialPairRoutingError"
    this.connectionNames = [
      input.connectionNames[0],
      input.connectionNames[1],
    ]
    this.reason = input.reason
  }
}
