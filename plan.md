# Post-processing differential-pair solver plan

## Agreed contract

- Add the standalone `PostProcessingSolver` (correcting the requested `PostProcessingSOlver` typo) to this package. It will be invoked by a consumer after the autorouter produces `getOutputSimplifiedPcbTraces()`; it will not be wired into the autorouter repository or import its source.
- Its input will contain the completed `SimplifiedPcbTraces`, differential-pair declarations, obstacles, board bounds, and layer count. Local structural copies of the SRJ simplified-trace types will be exported from this package, rather than importing the autorouter's internal source types.
- Its output will be `{ traces, errors }`, where `traces` is the complete replacement `SimplifiedPcbTraces` collection and `errors` is `Error[]`. Non-differential traces are returned unchanged. If a pair cannot be improved without violating hard geometry rules, its original two traces are returned unchanged and one descriptive generic `Error` is included.
- A pair is rerouted as a coupled bundle. It may use vias and layer changes, but both members must make corresponding layer changes and have equal via counts. The solver must not create a short circuit or route through other copper.
- All existing copper outside the pair currently being processed is immutable obstacle geometry. Sequentially process declared pairs; after a pair is accepted, its new copper becomes an obstacle to later pairs. Global multi-pair optimization is explicitly out of scope for v1.
- The preferred edge-to-edge pair spacing is the range `0.5 mm` through `1 mm`. It is a soft optimization objective, not a hard DRC constraint. Fixed terminal positions are necessarily allowed to lie outside that range.
- Hard clearance from obstacles and unrelated copper is derived from the relevant simplified wire trace width. The reroute must remain inside board bounds.
- Preserve each connection's own identity and endpoint connectivity. After coupled rerouting, run length matching as the final phase so the pair meets its declared `lengthTolerance`; inability to reach a valid final result is reported for that pair through `errors` with its original traces retained.

## Implementation steps

1. **Add standalone public types and exports.**
   - Extend `lib/types.ts` with structural `SimplifiedPcbTrace` / `SimplifiedPcbTraces` types compatible with the SRJ types supplied by the autorouter, including `wire` and `via` route entries and their widths/layers.
   - Add `PostProcessingSolverParams` and `PostProcessingSolverOutput` in `lib/post-processing/types.ts`. The params will require traces, differential pairs, obstacles, bounds, and layer count; the output will expose `traces` and `errors: Error[]`.
   - Export `PostProcessingSolver` and its input/output types from `lib/index.ts`.

2. **Build validated internal geometry.**
   - Add focused conversion/validation modules under `lib/post-processing/` that locate traces by `connection_name`, clone all output geometry, parse continuous wire/via paths into layer-aware segments, and retain PCB-port metadata when endpoints are reconstructed.
   - Validate each pair independently: both named connections must resolve to routable, non-branching geometry and their layer transitions must be representable as coupled transitions. Reject declarations that place one connection in multiple pairs. Expected per-pair infeasibility becomes an output `Error`; broken internal geometry or a violated invariant throws a specific error rather than being silently ignored.
   - Convert rectangles and immutable simplified traces into layer-specific inflated collision geometry, including footprint-sized jumper copper and through-obstacle entries without losing route continuity. Inflation will account for candidate trace width plus the required trace-width clearance. The two active pair traces are excluded from this obstacle set only while their replacement is searched.

3. **Route an individual differential pair as a bundle.**
   - Implement a small, deterministic layered path search for a pair centre/spine with fixed terminals. Search states will carry a common layer and paired via transitions, so a layer change emits matching vias for both members rather than independently routing P and N.
   - Generate paired candidate paths by offsetting the spine on a consistent side, with endpoint fan-in/fan-out segments connecting the fixed pads. Candidate spacing samples will cover the preferred `0.5–1 mm` interval and modest outside-range values so impossible terminal spacing does not block otherwise valid routes.
   - Keep search and final validation consistent for connected terminal egress and for locally oriented paired vias, using actual via diameters and checking obstacle `layers`/`zLayers`, immutable segments, and immutable vias. Reject any candidate that intersects inflated obstacles, immutable copper, the other active-pair member, or board bounds. Keep connection identities and endpoints intact.
   - Score valid candidates deterministically: geometry validity first, then penalty for interior edge-to-edge spacing outside the preferred range, path length / unnecessary bends / unnecessary via pairs, and clearance margin. This implements the spacing range as a goal rather than an artificial failure condition.

4. **Apply final length matching.**
   - Add a simplified-trace adapter or dedicated helper that measures the accepted wire/via paths and adjusts the pair as a final, geometry-checked operation until the declared `lengthTolerance` is met.
   - Reuse existing route-geometry and length-matching concepts only through explicit compatible data conversion; do not couple the new modules to autorouter source. Any added meander must preserve the bundle's collision constraints, connection identity, and coupled layer-transition rule.
   - Recompute pair-spacing quality from the final matched geometry rather than retaining the pre-matching sampled gap. Commit a pair atomically only after its reroute and final length matching both validate. Otherwise restore its cloned original geometry and append an `Error` that names the pair and failed constraint.

5. **Implement the solver lifecycle and debug view.**
   - Add `lib/PostProcessingSolver.ts` as the thin `BaseSolver` lifecycle owner. It will process one pair per `_step()`, maintain immutable-output cloning and pair index state, report progress, and expose the typed output only after solving.
   - Add a small visualization builder under `lib/post-processing/`: immutable obstacles in translucent red, existing/final traces layer-aware, and the active pair clearly highlighted. Use `GraphicsObject` conventions from the visualization skill and a non-empty debug view.

6. **Add focused tests and fixtures.**
   - Create one-test-per-file fixtures covering: a same-layer pair whose endpoints begin far apart and is improved toward the spacing range; a coupled-via/layer-transition pair with equal via counts; immutable unrelated traces/obstacles blocking unsafe candidates; an infeasible pair that returns original traces plus a generic `Error`; sequential pair processing; and final length tolerance after rerouting.
   - Add one minimal SVG snapshot test for the solver debug visualization, inspecting the generated artifact before accepting it.

7. **Validate.**
   - Run focused Bun tests with `--timeout 9999999`, then `bun run typecheck`, `bun run typecheck:structure`, and `bun run build`. Do not run formatter or general style linting.

## Deliberate v1 boundaries

- No global optimization across multiple differential pairs.
- No autorouter source imports or pipeline modifications.
- Pair-spacing range is a scored preference; collision clearance, bounds, connectivity, paired layer transitions, and final length matching remain hard requirements.
