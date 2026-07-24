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

The solver adds obstacle-aware, tapered multi-lobe meanders until each
differential pair is within its configured length tolerance. It normally tunes
only the shorter connection. When realizing the correction would require a
tooth shallower than `minMeanderHeight`, it can add a jointly validated meander
to each pair member instead of weakening the geometry constraint. For a
multi-segment match, every selected segment uses the same tooth count,
placement, and tapered profile. Invalid or impossible solver states throw with
a specific error instead of returning partially matched routes.

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

The matcher’s tuning unit is a maximal same-layer, forward-collinear span in the
original route point array. See `straight-route-spans.ts` for breakpoint rules
and `candidate-route-clearance.ts` for route-self-intersection checks.

## Development

```sh
bun install
bun run start
bun test
bun run build
```

`bun run start` opens the interactive React Cosmos fixture playground at
`http://localhost:5000`.
