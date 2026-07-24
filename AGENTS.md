# Length Matching Solver Development Guide

## Commands

- Build: `bun run build`
- Run tests: `bun test --timeout 9999999`
- Run specific test: `bun test tests/length-matching-linear-regression.test.ts --timeout 9999999`
- Run TypeScript checks: `bun run typecheck`
- Run file-structure checks: `bun run typecheck:structure`

> Don't format or run general style linting. Run the structural checks above.

## Validation Policy

- Run tests, builds, and focused checks locally by default.
- Use Blacksmith only when the user explicitly asks to use Blacksmith.

## Visualization Debugging

When changing or reviewing solver `visualize()` / `preview()` output, use the
`tscircuit-visualization` skill.

Prefer existing graphics artifact tooling instead of ad hoc screenshots.
Inspect generated SVG or PNG artifacts before making visual changes.

## Fallback Logic

> When a solver hits a state it can't explain, fix the root cause or throw. Do not add a fallback.

Fallback logic is an anti-pattern here and a common mistake when extending the
solver. A fallback is any code that lets the solver keep running after something
went wrong instead of surfacing it: catching a thrown error and continuing as if
it succeeded, `?? []` / `|| default` on data that should always exist, silently
trying another strategy after an invariant fails, or marking a solve `solved`
when it actually failed. Because execution continues, the result isn't a crash
you can debug—it is silently wrong routed geometry.

- **Don't** catch a solver-internal invariant error and return existing geometry
  as a successful result.
- **Do** throw a named, specific error that identifies the invalid connection,
  pair, route, or geometry state.
- The "avoid throwing" note under Code Style applies to recoverable I/O at the
  edges, not to solver-internal invariants. A loud failure on bad input beats a
  plausible-looking wrong route.

## Code Style Guidelines

- Use **TypeScript** with strict typing enabled.
- **Naming**: Name each TypeScript implementation file after its single function
  or class, preserving the symbol's casing (for example, `calculateLength.ts`
  or `LengthMatchingSolver.ts`). Use camelCase for variables/functions and
  PascalCase for classes/interfaces.
- **Imports**: Organize imports according to Biome rules when formatting is
  explicitly requested.
- **Error handling**: Use try/catch for recoverable I/O at the edges; do not
  swallow solver-internal errors. See **Fallback Logic** above—throw on
  unexpected or invalid solver state rather than adding a fallback.
- **Formatting**: Use Biome conventions: 2-space indentation and double quotes
  for JSX.
- **Comments**: Add meaningful comments for complex logic; avoid unnecessary
  comments.
- **Export patterns**: Export classes and functions directly from their
  definition files.
- Avoid over-abstraction. Prefer direct code until a helper removes real
  duplication or clarifies a genuinely complex operation.
- Do not create functions smaller than 6 lines.
- Define types near the start of new code so variables, function parameters,
  and return values have explicit types.
- Always define function return types in new code.
- Structure types so invalid states are not representable where practical.
- Keep implementation details private wherever possible. Public functions and
  classes should be thin entry points that validate inputs and imperatively
  orchestrate focused functions from appropriately named private/internal
  modules and subfolders instead of containing detailed implementation logic.

## File Organization Rules

- Every TypeScript file must contain fewer than 500 lines of code.
- Keep exactly one test case per test file.
- A folder may contain at most ten TypeScript files. When a folder would exceed
  this limit, create clearly named subfolders and categorize the files by
  purpose.
- Keep only one top-level function or class per TypeScript implementation file.
  The filename must exactly match that function or class name, including casing.

## Architecture

The package exposes `LengthMatchingSolver` and its input/output types from
`lib/index.ts`. Keep the solver package standalone: depend on small published
utilities where appropriate and do not import source files from the capacity
autorouter repository.

Use the `tscircuit-create-solver` skill when creating another solver or changing
the solver lifecycle contract.

For meander generation or ranking changes, start with
`docs/meander-electrical-quality.md`, then use the ownership map in
`lib/length-matching/README.md`. Candidate pitch generation belongs in
`meander-candidate.ts`; stackup-independent ranking belongs in
`meander-quality.ts`; do not describe its score as calculated impedance,
inductance, or delay. A pitch or score change needs a ranking unit test and an
end-to-end geometry regression. Use the visualization workflow above when that
regression changes an SVG snapshot.

## Writing Tests

When writing visualization snapshot tests, read the `tscircuit-visualization`
skill first. Do not set timeouts in test code; pass a large timeout to the Bun
test command, such as `--timeout 9999999`.

When asked to update snapshots, run:

```bash
BUN_UPDATE_SNAPSHOTS=1 bun test --timeout 9999999
```

If only specific tests are failing because of a change, update only those
failing tests. Do not spend time updating every test.
