# Length matching code map

`length-matching-solver.ts` owns only the `BaseSolver` lifecycle and state changes.

- `config.ts`: validate public inputs and resolve defaults.
- `connection-routes.ts`: map logical connections to routed branches and lengths.
- `../route-geometry.ts`: shared planar segment and route-length primitives.
- `straight-route-spans.ts`: partition routed points into maximal tunable spans.
- `meander-candidate.ts`: enumerate tooth-count, placement, and pitch choices,
  then fit clearance-limited tooth depths for each span.
- `meander-geometry.ts`: construct and corner-round a meander replacement for one straight route span.
- `candidate-route-clearance.ts`: validate meanders against untouched route
  geometry and same-connection sibling branches.
- `meander-quality.ts`: rank feasible candidates with stackup-independent
  geometry proxies.
- `multi-segment-plan.ts`: identify pitch-specific attempts and choose the
  minimum-segment same-tooth-count partial plan.
- `geometry-validation.ts`: bounds, obstacle, and trace-clearance decisions.
- `visualization/index.ts`: compose the solver debug `GraphicsObject` in draw order.
- `visualization/color-theme.ts`: the shared `createLengthMatchingColorTheme()` API for all colors and opacity.
- `visualization/build-*.ts`: create route, obstacle, or candidate graphics only; never resolve colors.
- `visualization/graphics-layers.ts`: convert PCB layers into graphics-debug layers.
- `internal-types.ts`: shared feature state; keep it solver-private.

The design rationale, empirical score terms, source research, limitations, and
test index for relaxed meanders live in
[`../../docs/meander-electrical-quality.md`](../../docs/meander-electrical-quality.md).

Keep new algorithm work in its owning module. Do not import the solver class from these modules.

## Multi-segment matching

A tunable straight span is a maximal run of consecutive, same-layer,
forward-collinear edges. Direction changes, reversals, layer changes,
jumper-pad points, through-obstacle metadata, and unsupported width changes
terminate a span; redundant zero-length points are absorbed. Spans retain
indexes into the original route; accepted replacements are applied from higher
indexes to lower indexes so later stored end indexes remain stable.

`LengthMatchingSolver` first tries every candidate as a single-segment match.
When no single segment can supply the required length, it records each valid
partial candidate and chooses the fewest same-style segment choices whose
combined capacity reaches the target. Every selected segment uses the same
tooth count, placement, and tapered profile; the solver allocates the added
length without exceeding any selected segment's capacity. Among plans using the
same number of segments, it chooses the highest aggregate quality score.

Every feasible full match receives a default quality score from 0 to 100. The
solver prefers relaxed tuning spread across a broad baseline. For every tooth
count it tries a relaxed pitch derived from the segment, the geometric mean of
that pitch and the minimum pitch, and the minimum-clearance pitch. Keeping the
compact candidate allows constrained regions to use the same search.

High maximum-depth-to-half-pitch ratio, added length per occupied baseline,
extra active teeth, deviation from the intended tapered or uniform profile, and
added length relative to the source segment reduce the score. The weights are
internal ranking preferences, not public design-rule inputs. Within one segment, a
multi-tooth meander follows a tapered height envelope: smaller lobes at each
end, higher lobes toward its center, and per-tooth clearance caps. The score is
a stackup-independent geometry preference, not an impedance or delay model, and
lives in `meander-quality.ts`.

## Focused tests

- `meander-quality-score.test.ts`: electrical-risk proxy ranking.
- `meander-clearance-options.test.ts`: derived minimum, intermediate, and
  relaxed pitches plus public overrides.
- `usb-default-clearance-sample.test.ts`: broad, shallow free-space behavior.
- `length-matching-linear-regression.test.ts`: fitted geometry and SVG snapshot.
- `multi-segment-route-length-matching.test.ts`: partial-plan consistency.
- `collinear-route-points.test.ts`: redundant collinear points form one span.
- `straight-route-spans.test.ts`: span boundaries and semantic metadata.
- `self-route-clearance.test.ts`: meanders cannot cross untouched own-route edges.
- `narrow-corridor-no-meander.test.ts`: loud failure when no candidate fits.
- `constrained-compact-meander-selection.test.ts`: compact-pitch success when
  relaxed alternatives collide with obstacles.

## Visualization API

Build debug views with `createLengthMatchingColorTheme(colorMap)` from
`./visualization/color-theme` rather than
reading a color map or calling `transparentize()` directly. The theme preserves
caller overrides, derives deterministic connection colors, and keeps opacity
handling consistent across route and candidate graphics.
