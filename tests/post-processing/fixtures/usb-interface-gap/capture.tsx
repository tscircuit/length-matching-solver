import { Circuit, getSimpleRouteJsonFromCircuitJson } from "@tscircuit/core"
import { AutoroutingPipelineSolver9_PreloadedTraceGraph } from "@tscircuit/capacity-autorouter"
import { usbInterfaceGapBoard } from "./board"

const circuit = new Circuit()
circuit.add(usbInterfaceGapBoard)
await circuit.renderUntilSettled()
const circuitJson = circuit.getCircuitJson()
const placementErrors = circuitJson.filter((element) =>
  element.type.endsWith("_error"),
)
if (placementErrors.length > 0) throw new Error(JSON.stringify(placementErrors))
const subcircuitComponent = circuit.firstChild
if (!subcircuitComponent) throw new Error("Missing rendered board")
const { simpleRouteJson } = getSimpleRouteJsonFromCircuitJson({
  db: circuit.db,
  subcircuitComponent,
})
await Bun.write(
  "board.circuit.json",
  JSON.stringify(circuitJson, null, 2) + "\n",
)
await Bun.write(
  "board.srj.json",
  JSON.stringify(simpleRouteJson, null, 2) + "\n",
)
const router = new AutoroutingPipelineSolver9_PreloadedTraceGraph(
  simpleRouteJson,
  { cacheProvider: null },
)
router.solveUntilPhase("lengthMatchingPostProcessingSolver")
if (
  !router.lengthMatchingPostProcessingSolver &&
  !router.failed &&
  !router.solved
)
  router.step()
if (!router.lengthMatchingPostProcessingSolver)
  throw new Error(`Post-processing stage not reached: ${router.error}`)
const [params] =
  router.lengthMatchingPostProcessingSolver.getConstructorParams()
await Bun.write("post-processing.json", JSON.stringify(params, null, 2) + "\n")
router.solve()
if (router.failed) throw new Error(router.error ?? "Pipeline 9 failed")
console.log(
  JSON.stringify({
    pairs: params.differentialPairs,
    obstacleMargin: params.obstacleMargin,
    routes: params.hdRoutes.length,
    obstacles: params.obstacles.length,
    layerCount: params.layerCount,
    upstreamSolved: router.solved,
  }),
)
