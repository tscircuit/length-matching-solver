# Length matching code map

`length-matching-solver.ts` owns only the `BaseSolver` lifecycle and state changes.

- `config.ts`: validate public inputs and resolve defaults.
- `connection-routes.ts`: map logical connections to routed branches and lengths.
- `../route-geometry.ts`: shared planar segment and route-length primitives.
- `meander-candidate.ts`: generate, construct, and regression-evaluate square-wave meanders.
- `geometry-validation.ts`: bounds, obstacle, and trace-clearance decisions.
- `visualization/index.ts`: compose the solver debug `GraphicsObject` in draw order.
- `visualization/color-theme.ts`: the shared `createLengthMatchingColorTheme()` API for all colors and opacity.
- `visualization/build-*.ts`: create route, obstacle, or candidate graphics only; never resolve colors.
- `visualization/graphics-layers.ts`: convert PCB layers into graphics-debug layers.
- `internal-types.ts`: shared feature state; keep it solver-private.

Keep new algorithm work in its owning module. Do not import the solver class from these modules.

## Visualization API

Build debug views with `createLengthMatchingColorTheme(colorMap)` from
`./visualization/color-theme` rather than
reading a color map or calling `transparentize()` directly. The theme preserves
caller overrides, derives deterministic connection colors, and keeps opacity
handling consistent across route and candidate graphics.
