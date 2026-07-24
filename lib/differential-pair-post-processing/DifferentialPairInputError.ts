export type DifferentialPairInputErrorCode =
  | "duplicate_pair_name"
  | "invalid_board"
  | "invalid_design_rule"
  | "invalid_geometry"
  | "invalid_layer_count"
  | "invalid_pair"
  | "invalid_state"
  | "missing_pair_trace"

export class DifferentialPairInputError extends Error {
  readonly name = "DifferentialPairInputError"

  constructor(
    readonly code: DifferentialPairInputErrorCode,
    message: string,
  ) {
    super(message)
  }
}
