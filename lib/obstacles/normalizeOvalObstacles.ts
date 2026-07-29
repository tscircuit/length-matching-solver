import type { Obstacle } from "../types"

/** Converts ovals to conservative axis-aligned rectangles for collision stages. */
export const normalizeOvalObstacles = (obstacles: Obstacle[]): Obstacle[] =>
  obstacles.map((obstacle) => {
    if (obstacle.type === "rect") return structuredClone(obstacle)
    const radians = ((obstacle.ccwRotationDegrees ?? 0) * Math.PI) / 180
    const cosine = Math.abs(Math.cos(radians))
    const sine = Math.abs(Math.sin(radians))
    const { ccwRotationDegrees: _rotation, ...unrotatedObstacle } = obstacle
    return {
      ...structuredClone(unrotatedObstacle),
      type: "rect" as const,
      width: obstacle.width * cosine + obstacle.height * sine,
      height: obstacle.width * sine + obstacle.height * cosine,
    }
  })
