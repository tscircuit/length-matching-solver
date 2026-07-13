# Length matching code map

`length-matching-solver.ts` owns only the `BaseSolver` lifecycle and state changes.

- `config.ts`: validate public inputs and resolve defaults.
- `connection-routes.ts`: map logical connections to routed branches and lengths.
- `../route-geometry.ts`: shared planar segment and route-length primitives.
- `meander-candidate.ts`: generate, construct, and regression-evaluate square-wave meanders.
- `meander-geometry.ts`: construct and corner-round a meander replacement for one route segment.
- `multi-segment-plan.ts`: choose the minimum-segment same-tooth-count partial plan.
- `geometry-validation.ts`: bounds, obstacle, and trace-clearance decisions.
- `visualization/index.ts`: compose the solver debug `GraphicsObject` in draw order.
- `visualization/color-theme.ts`: the shared `createLengthMatchingColorTheme()` API for all colors and opacity.
- `visualization/build-*.ts`: create route, obstacle, or candidate graphics only; never resolve colors.
- `visualization/graphics-layers.ts`: convert PCB layers into graphics-debug layers.
- `internal-types.ts`: shared feature state; keep it solver-private.

Keep new algorithm work in its owning module. Do not import the solver class from these modules.

## Multi-segment matching

`LengthMatchingSolver` first tries every candidate as a single-segment match.
When no single segment can supply the required length, it records each valid
partial candidate and chooses the fewest same-style segment choices whose
combined capacity reaches the target. Every selected segment uses the same
tooth count, placement, and tapered profile; the solver allocates the added
length without exceeding any selected segment's capacity. Among plans using the
same number of segments, it chooses the highest aggregate quality score.

Every feasible full match receives a default quality score from 0 to 100. The
solver first prefers fewer reversals, then shallow, low-detour curves; deep
excursions and extra bends reduce the score. Within one segment, a
multi-tooth meander follows a tapered height envelope: smaller lobes at each
end, higher lobes toward its center, and per-tooth clearance caps. The score is
a routing-style preference, not a fabrication rule, and lives in
`meander-quality.ts`.

## Visualization API

Build debug views with `createLengthMatchingColorTheme(colorMap)` from
`./visualization/color-theme` rather than
reading a color map or calling `transparentize()` directly. The theme preserves
caller overrides, derives deterministic connection colors, and keeps opacity
handling consistent across route and candidate graphics.
