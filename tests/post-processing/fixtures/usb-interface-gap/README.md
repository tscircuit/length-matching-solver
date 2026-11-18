# Native USB interface gap capture

This board was created for the review request on length-matching-solver #95. It connects a native `usbmicro` footprint to a native `soic16` signal endpoint through two named traces and a `<differentialpair pcbTraceGap={0.3} maxLengthSkew={0.1} />`. Trace width and trace-to-pad clearance are both 0.15 mm. No maximum uncoupled length is specified.

Core renders all component geometry and validates placement. Its public `getSimpleRouteJsonFromCircuitJson` output is routed with the public Pipeline 9 solver. `post-processing.json` is the complete, unmodified constructor argument captured from `lengthMatchingPostProcessingSolver` before that stage runs. It retains both HD routes, all 27 obstacles, connections, constraints, widths, bounds and layers. There are no renamed nets, shifted pads, hand-authored copper routes, or removed obstacles in the replay fixture.

`board.circuit.json` is core's native placement output, including 23 SMT pads, four plated connector holes, PCB ports and silkscreen. The snapshot helper appends the solver's emitted top-layer copper directly to those native elements. It does not draw replacement rectangles for pads. The ordinary tests read these two JSON files and do not depend on core or the capacity autorouter.

## Producer

- Bun 1.4.3.
- `@tscircuit/core` 0.0.2410.
- `@tscircuit/capacity-autorouter` 0.0.1124, Pipeline 9, default effort, cache disabled.
- `@tscircuit/props` 0.0.738; `@tscircuit/footprinter` 0.0.451.
- The captured producer uses `obstacleMargin: 0.15`; this agrees with the standalone post-processor's trace-width-based pad-clearance default. No clearance field or geometry is changed for replay.

The optional capture manifest also pins the producer's installed peer packages. To regenerate in a separate directory, copy this folder's `board.tsx`, `capture.tsx` and `capture-package.json` there, rename the manifest to `package.json`, then run:

```sh
bun install
bun run capture
```

The capture script checks placement errors, runs Pipeline 9 to its post-processing boundary, writes the complete constructor input and native circuit JSON, and verifies that the producer pipeline completes. It also writes `board.srj.json` for inspection; the SRJ is not needed by the standalone regression tests.

SHA-256 of the checked-in UTF-8 files, including final newlines:

```text
645f8b9ea18d38b9e07760c473dbdae2a19beaeb7b058c1d03459c353403d9b6  post-processing.json
627754aa43b48b4d2196e752b4d1bf4a3f864d1ce2ea8a63fc9c69fbb39606b6  board.circuit.json
```

## Observed behavior

On the repro base, the solver returns its input routes with a `no-valid-candidate` diagnostic. The emitted top-layer copper gap is 0.50 mm at x = -3, 0 and +3 mm, despite the feasible 0.30 mm request. The fix returns no post-processing diagnostics and produces 0.30 mm at all three sections, with endpoints and widths preserved.

`native-usb-trace-gap.test.ts` asserts the requested result; it is an expected failure in the repro PR and a normal passing test in the fix PR. The separate normal snapshot test records the incorrect board in the repro PR and the corrected board in the fix PR. The smaller generated-pad cases remain unit coverage for stagger, orientation and short-span edge cases.
