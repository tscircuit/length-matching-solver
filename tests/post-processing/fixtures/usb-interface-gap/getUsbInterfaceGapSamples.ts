import type { HighDensityRoute } from "../../../../lib"

type CopperSample = { y: number; width: number }

/** Measure top-layer copper gaps across the captured board's parallel run. */
export function getUsbInterfaceGapSamples(
  hdRoutes: HighDensityRoute[],
): number[] {
  if (hdRoutes.length !== 2)
    throw new Error("The native USB capture must contain exactly two routes")
  return [-3, 0, 3].map((x): number => {
    const samples = hdRoutes.map(({ route, traceThickness }): CopperSample => {
      for (let index = 1; index < route.length; index++) {
        const start = route[index - 1]!
        const end = route[index]!
        if (
          start.z !== 0 ||
          end.z !== 0 ||
          start.x === end.x ||
          (start.x - x) * (end.x - x) > 0
        )
          continue
        return {
          y: start.y + ((x - start.x) * (end.y - start.y)) / (end.x - start.x),
          width: Math.max(
            start.traceThickness ?? traceThickness,
            end.traceThickness ?? traceThickness,
          ),
        }
      }
      throw new Error(`No top-layer USB wire crosses x=${x}`)
    })
    return (
      Math.abs(samples[0]!.y - samples[1]!.y) -
      (samples[0]!.width + samples[1]!.width) / 2
    )
  })
}
