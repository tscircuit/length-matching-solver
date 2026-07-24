import { transparentize } from "polished"

/** Color decisions shared by every length-matching debug graphics builder. */
export type LengthMatchingColorTheme = {
  getConnectionColor: (
    connectionName: string,
    routeConnectionName?: string,
  ) => string
  getInnerLayerConnectionColor: (color: string) => string
  getTestedSegmentColor: (color: string) => string
  getRejectedCandidateColor: (color: string) => string
  boardBounds: { fill: string; stroke: string }
  obstacle: { fill: string; stroke: string }
  via: { fill: string; stroke: string }
}

/** Create the deterministic palette used by all length-matching visualizations. */
export const createLengthMatchingColorTheme = (
  colorMap: Record<string, string>,
): LengthMatchingColorTheme => {
  const getDeterministicConnectionColor = (connectionName: string): string => {
    if (!connectionName) return "rgba(0, 0, 0, 0.5)"
    const characterSum = connectionName
      .split("")
      .reduce((total, character) => total + character.charCodeAt(0), 0)
    return `hsl(${((characterSum * 300) / connectionName.length) % 360}, 100%, 50%)`
  }
  for (const color of Object.values(colorMap)) transparentize(0, color)
  return {
    getConnectionColor: (connectionName, routeConnectionName) =>
      colorMap[connectionName] ??
      (routeConnectionName ? colorMap[routeConnectionName] : undefined) ??
      getDeterministicConnectionColor(connectionName),
    getInnerLayerConnectionColor: (color) => transparentize(0.5, color),
    getTestedSegmentColor: (color) => transparentize(0.55, color),
    getRejectedCandidateColor: (color) => transparentize(0.45, color),
    boardBounds: { fill: "rgba(30,41,59,0.03)", stroke: "rgba(30,41,59,0.55)" },
    obstacle: { fill: "rgba(255,0,0,0.25)", stroke: "rgba(255,0,0,0.5)" },
    via: { fill: "blue", stroke: "none" },
  }
}
