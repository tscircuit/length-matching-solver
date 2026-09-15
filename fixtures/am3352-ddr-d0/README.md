# AM3352 DDR_D0 exhausted-search reproduction

This fixture captures an observed `LengthMatchingNoSolutionError` in the AM3352 development board's byte-bus matching. It is a reproduction, not a solver fix or proof that a valid meander exists within these constraints.

Run from the repository root:

```sh
bun install
RUN_AM3352_DDR_REPRO=1 bun test tests/repros/am3352-ddr-d0.test.ts --timeout 9999999
```

The test is deliberately opt-in because the exhausted-search path is slow. A passing test confirms the **existing failure**: `meander-search-exhausted` for `source_net_70` (`DDR_D0`), with `required 9.9183mm` in the message. It must be revised when that behavior changes. Normal `bun test` skips it.

## Provenance

- Board: https://tscircuit.com/seveibar/am3352-dev-board (published version 1.0.1).
- Placement: 70 × 60 mm, eight layers. Routing experiment used 0.1 mm signal width/clearance and 0.3/0.15 mm via pad/hole.
- Producer: `@tscircuit/capacity-autorouter@0.0.900`, `AutoroutingPipelineSolver9_PreloadedTraceGraph`, `{ effort: 1 }`.
- Length matcher commit bundled by the producer: `96cca6783a6e29d12bb1871185efe6ff2257bef8`, also the repository HEAD used to reproduce.
- The original SRJ contained 47 DDR connections, 908 obstacles, 15 preloaded clock/reference traces, three buses (11/11/24 members, 0.635 mm skew), and three differential pairs (0.127 mm skew, 0.12 mm gap). Non-DDR signal/power phases were not yet routed.
- The full producer run failed after 876.351 seconds in `lengthMatchingPostProcessingSolver`; that is full-pipeline time, not the isolated test runtime.

`input.json.gz` is the constructor input captured immediately before the producer's `busLengthMatchingSolver` first stepped, after differential-pair processing. It contains 48 high-density routes and 908 obstacles. The producer represents a bus as pairwise length comparisons to its longest member; the retained first comparison is `source_net_70` (`DDR_D0`) against `source_net_87` (`DDR_D5`), tolerance 0.635 mm. These are two byte-bus members, **not a physical differential pair**.

Only the subsequent comparison requests were removed (`differentialPairs.slice(0, 1)`). The solver fails on this first request, before those later requests run. All route geometry, obstacles, original connections, bounds, and layer/clearance settings are retained. This is a stage-isolated reproduction, not a geometrically minimized one.

The payload is gzip-compressed to avoid adding roughly 5 MB of largely repetitive obstacle connectivity metadata. Decompress for inspection:

```sh
gzip -dc fixtures/am3352-ddr-d0/input.json.gz > /tmp/am3352-ddr-d0.json
```

SHA-256 of decompressed UTF-8 JSON (including final newline):
`7849a1472a4903e38f9da40ce00590bbfdc55050befda898149dcfd315b7705c`.

The input has not been established to be globally DRC-clean or physically feasible. This PR records solver search behavior without implying that failure is necessarily incorrect. No production code or tolerances are changed.

## Verified replay

On Bun 1.3.2, macOS arm64, at the commit above, the standalone opt-in test passed all nine assertions in **178.616 seconds / 59 solver iterations**, reproducing the exact error and required added length. Runtime is informational, not an assertion. Typecheck, build, and structural checks also passed (structural checks retain existing repository warnings); the default test invocation skips this reproduction.
