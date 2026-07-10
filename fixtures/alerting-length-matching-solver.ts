import { LengthMatchingSolver } from "../lib/length-matching-solver"

/** Presents any fixture solver failure to the browser while preserving its failed state. */
export class AlertingLengthMatchingSolver extends LengthMatchingSolver {
  private hasReportedFailure = false

  override _step(): void {
    try {
      super._step()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.failed = true
      this.error = message
      if (this.hasReportedFailure || typeof window === "undefined") return

      this.hasReportedFailure = true
      window.alert(`${this.getSolverName()} failed.\n\n${message}`)
    }
  }
}
