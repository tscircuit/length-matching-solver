# @tscircuit/length-matching-solver

Standalone differential-pair length matching for routed PCB traces.

```ts
import { LengthMatchingSolver } from "@tscircuit/length-matching-solver"

const solver = new LengthMatchingSolver({
  hdRoutes,
  originalConnections,
  differentialPairs,
})

solver.solve()
const { matchedHdRoutes } = solver.getOutput()
```

The direct matcher accepts exact copper-hop memberships:

```ts
import type { LengthMatchingPair } from "@tscircuit/length-matching-solver"

const differentialPairs: LengthMatchingPair[] = [{
  connectionNames: [["P_before", "P_after"], ["N_before", "N_after"]],
  maxLengthSkewMm: 0.1,
}]
```

Each name must identify exactly one two-terminal `originalConnections` entry
and one complete `hdRoutes` polyline with that exact `connectionName`. Stitch
route fragments before matching. Hop counts may differ between lanes; the
matcher sums each lane's planar copper, excluding gaps between hops, via
barrels, fixed traces, and unlisted taps. Keep each route's real
`rootConnectionName` for electrical clearance; it never selects counted copper.
Empty lanes, duplicate ownership, incomplete routes, and unmet final skew fail
the solve. `getOutput()` is available only after successful completion.

This replaces the direct matcher's scalar pair names and `lengthTolerance`.
Callers must preserve hop names and endpoints through routing, pass every
listed route, and propagate thrown errors or `failed` instead of accepting
best-effort output. Revalidate constraints after later geometry mutations.

The solver adds obstacle-aware, tapered multi-lobe meanders until each
differential pair is within its configured length tolerance. It normally tunes
only the shorter connection. When realizing the correction would require a
tooth shallower than `minMeanderHeight`, it can add a jointly validated meander
to each pair member instead of weakening the geometry constraint. For a
multi-segment match, every selected segment uses the same tooth count,
placement, and tapered profile. Invalid or impossible solver states throw with
a specific error instead of returning partially matched routes.

## HD-route post-processing

`PostProcessingSolver` accepts and returns native high-density routes, so an
autorouting pipeline does not need to serialize routes before post-processing:

```ts
import { PostProcessingSolver } from "@tscircuit/length-matching-solver"

const solver = new PostProcessingSolver({
  hdRoutes,
  differentialPairs,
  obstacles,
  bounds,
  layerCount,
  // routingGrid: { innerGridStep: 0.25 },
})
solver.solve()
const { hdRoutes: postProcessedHdRoutes } = solver.getOutput()
```

Pair members resolve by `connectionName` or `rootConnectionName` and must each
identify exactly one route. Unsupported or ambiguous geometry throws. Input,
immutable non-pair routes, and returned outputs are independently cloned.
This coupled API retains its existing `DifferentialPair` type (two scalar
names and `lengthTolerance`); its internal matcher adapter uses singleton hop
lists. The optional centerline preferences on `LengthMatchingPair` preserve
this caller's existing meander ranking.

## Meander geometry quality

In open routing space, the solver prefers broad, shallow tuning distributed
over the available baseline instead of a narrow, deep hairpin. It evaluates a
maximally relaxed pitch, an intermediate pitch, and the minimum-clearance pitch
for each tooth count. Keeping the compact option allows the same search to work
in constrained regions.

The quality score uses geometry-only electrical-risk proxies: depth-to-pitch
aspect ratio, added-length density, deviation from the intended depth profile,
bend count, and detour severity. It does not calculate impedance, inductance, or
propagation delay; those require a PCB stackup and signal information that are
not solver inputs.
See [Meander electrical-quality heuristic](docs/meander-electrical-quality.md)
for the rationale, exact scoring model, limitations, owning files, and tests.

| Input | Default and meaning |
| --- | --- |
| `maximumMeanderDepth` | `5` mm maximum normal excursion. |
| `maxToothCount` | `12` teeth per candidate. |
| `minimumToothPitch` | Optional lower bound, not a fixed requested pitch. |
| `minMeanderGap` | Greater of `0.3` mm and twice the trace width. |
| `minMeanderHeight` | Trace width plus the resolved meander gap. |

The actual minimum pitch is the greater of `minimumToothPitch` and twice the
resolved centerline spacing. Public input types are documented in
[`lib/length-matching/types.ts`](lib/length-matching/types.ts).

## Code map

Algorithm ownership and data flow are indexed in
[`lib/length-matching/README.md`](lib/length-matching/README.md). Visualization
has a separate [code map](lib/length-matching/visualization/README.md).

## Development

```sh
bun install
bun run start
bun test
bun run build
```

`bun run start` opens the interactive React Cosmos fixture playground at
`http://localhost:5000`.

### Fixed SRJ traces

Both `LengthMatchingSolver` and `PostProcessingSolver` accept optional `traces`
containing fixed SRJ `SimplifiedPcbTraces`. They participate in clearance checks
using layer-aware wire segments and via diameters, without rectangle conversion.
Fixed traces are never tuned, counted toward matching lengths, or included in the
returned HD routes; the caller retains them in its SRJ. `obstacleMargin` (or
`minTraceToPadEdgeClearance` for post-processing) sets the edge clearance.
