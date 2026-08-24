import { expect, test } from "bun:test"
import { getMeanderCenterlineDistanceCost } from "../../../lib/length-matching/candidate/getMeanderCenterlineDistanceCost"

test("returns null when paired same-layer geometry is unavailable", () => {
  const centerlineDistanceCost = getMeanderCenterlineDistanceCost({
    meanderPoints: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
    pairedRoutes: [
      {
        connectionName: "N",
        traceThickness: 0.15,
        viaDiameter: 0.6,
        route: [
          { x: 0, y: 1, z: 1 },
          { x: 1, y: 1, z: 1 },
        ],
        vias: [],
      },
    ],
    minimumCenterlineDistance: 0.15,
    maximumCenterlineDistance: 0.5,
  })

  expect(centerlineDistanceCost).toBeNull()
})
