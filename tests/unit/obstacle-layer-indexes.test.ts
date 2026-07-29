import { expect, test } from "bun:test"
import { getObstacleLayerIndexes } from "../../lib/obstacles/getObstacleLayerIndexes"
import type { Obstacle } from "../../lib"

test("prefers canonical obstacle layers while retaining legacy layer inputs", () => {
  const obstacle: Obstacle = {
    type: "rect",
    layers: ["top"],
    zLayers: [0],
    __zLayers: [1],
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    connectedTo: [],
  }
  expect(getObstacleLayerIndexes(obstacle, 4)).toEqual([1])
  expect(
    getObstacleLayerIndexes(
      { ...obstacle, __zLayers: undefined, zLayers: [2] },
      4,
    ),
  ).toEqual([2])
  expect(
    getObstacleLayerIndexes(
      {
        ...obstacle,
        __zLayers: undefined,
        zLayers: undefined,
        layers: ["top", "inner2", "bottom"],
      },
      4,
    ),
  ).toEqual([0, 2, 3])
  expect(() =>
    getObstacleLayerIndexes({ ...obstacle, __zLayers: [] }, 4),
  ).toThrow(/invalid z-layer indexes/)
  expect(() =>
    getObstacleLayerIndexes({ ...obstacle, __zLayers: [4] }, 4),
  ).toThrow(/invalid z-layer indexes/)
  expect(() =>
    getObstacleLayerIndexes(
      {
        ...obstacle,
        __zLayers: undefined,
        zLayers: undefined,
        layers: ["unknown"],
      },
      4,
    ),
  ).toThrow(/invalid layer name/)
})
