# Meander electrical-quality heuristic

This document owns the rationale and implementation map for choosing meander
geometry when the solver has free routing space. It is the starting point for
changes to pitch exploration or `qualityScore`.

## Decision

Prefer relaxed tuning: use wider pitch, shallower excursions, and distribute
the required added length over more baseline distance. Retain compact
minimum-clearance candidates because obstacles can make relaxed geometry
infeasible.

When a differential pair supplies `minimumCenterlineDistance` or
`maximumCenterlineDistance`, candidate ranking also applies a soft,
length-weighted cost for the meander's closest same-layer centerline distance
to the paired route. This is a preference rather than a clearance rule, so
constrained geometry can still be matched.

For every segment and tooth count, `createMeanderCandidates()` evaluates three
deterministic pitches:

1. `segmentLength / (toothCount + 1)`, which spreads the teeth across the
   available segment.
2. The geometric mean of the relaxed and minimum pitches, which provides a
   constrained intermediate footprint.
3. The minimum pitch derived from the public clearance inputs.

Duplicate pitches are removed. Geometry validation still decides whether each
candidate fits bounds, obstacles, layers, and routed-trace clearance.

## Why

Published signal-integrity guidance consistently warns that adjacent legs of a
serpentine can self-couple. Dense meanders can therefore produce waveform
distortion and an effective delay different from the delay implied by physical
trace length. Research on meander alleviation recommends increasing meander
width and spacing and distributing tuning more evenly.

This package cannot determine actual electrical behavior because its inputs do
not include reference-plane height, dielectric properties, copper thickness,
driver edge rate, frequency content, voltage, or current. The solver therefore
uses conservative geometry proxies and leaves final verification to a field or
channel solver.

Primary references:

- [AMD, Intra-pair Trace Length Matching](https://docs.amd.com/r/en-US/xapp1392-pcb-chan-design-guidelines/Intra-pair-Trace-Length-Matching)
  recommends sufficient spacing between adjacent serpentine legs and validating
  compensation structures with simulation.
- [Texas Instruments, High-Speed PCB Layout for PCIe Gen 5](https://www.ti.com/lit/an/snla426/snla426.pdf)
  recommends avoiding serpentines when possible and relates their dimensions to
  trace width and reference-plane height.
- [Tseng et al., Post-Route Alleviation of Dense Meander Segments](https://arxiv.org/abs/1705.04983)
  reports same-wire crosstalk speedup in dense meanders and motivates wider,
  more evenly distributed patterns.
- [Rubin and Singh, Study of Meander Line Delay in Circuit Boards](https://research.ibm.com/publications/study-of-meander-line-delay-in-circuit-boards--1)
  models the three-dimensional and pitch-dependent behavior of PCB meanders.

## Score

`getMeanderQualityScore()` returns a preference from 0 to 100 when no
centerline preference is set. Higher is better. An enabled centerline cost can
lower the score below zero so candidates outside the requested range retain a
deterministic ordering. For non-zero tooth depths, it subtracts these empirical
penalties:

| Term | Formula | Purpose |
| --- | --- | --- |
| Aspect ratio | `40 * r / (1 + r)`, where `r = maximumDepth / (toothPitch / 2)` | Reject narrow, deep hairpins. |
| Tuning density | `30 * d / (1 + d)`, where `d = addedLength / occupiedBaselineLength` | Spread added length over baseline distance. |
| Profile deviation | Up to 10 points for deviation from the intended tapered or uniform envelope | Avoid clearance-capped or otherwise irregular lobes. |
| Bend burden | 2 points per additional active tooth | Keep a non-zero cost for every reversal. |
| Detour | Up to 7 points from added length relative to segment length | Prefer smaller corrections when other geometry is equal. |
| Centerline range | `100 *` length-weighted distance outside the optional pair range | Favor meanders that remain near the paired route. |

The weights are deterministic ranking preferences, not extracted electrical
parameters. Do not expose the result as impedance, inductance, EMI, or delay.

Multi-segment plans use mean candidate quality so adding attempts cannot inflate
the score. Each segment after the first costs another 3 points. This allows a
materially gentler distributed plan to beat a deep single-segment candidate
without making fragmentation free.

## Ownership

- `lib/length-matching/meander-candidate.ts`: minimum pitch, relaxed pitch
  enumeration, depth fitting, candidate evaluation, and optional paired-route
  centerline-distance cost.
- `lib/length-matching/meander-quality.ts`: geometry score and empirical
  weights.
- `lib/length-matching/meander-geometry.ts`: rounded physical route geometry.
- `lib/length-matching/geometry-validation.ts`: obstacles, bounds, layers, and
  trace clearance.
- `lib/length-matching/multi-segment-plan.ts`: candidate identity and partial
  plan selection.

## Tests

- `tests/meander-quality-score.test.ts`: broad distributed geometry outranks
  concentrated and uneven alternatives.
- `tests/meander-clearance-options.test.ts`: relaxed, intermediate, and compact
  pitch candidates preserve automatic and explicit clearance behavior.
- `tests/usb-default-clearance-sample.test.ts`: open-space integration behavior.
- `tests/constrained-compact-meander-selection.test.ts`: compact-pitch success
  when obstacles reject relaxed alternatives.
- `tests/length-matching-linear-regression.test.ts`: routed geometry and visual
  snapshot.
- `tests/narrow-corridor-no-meander.test.ts`: constrained failure remains loud;
  no invalid fallback route is accepted.

Run the focused tests with a command-level timeout:

```sh
bun test tests/meander-quality-score.test.ts tests/meander-clearance-options.test.ts tests/usb-default-clearance-sample.test.ts --timeout 9999999
```
