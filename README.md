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

The solver adds obstacle-aware, tapered multi-lobe meanders to the shorter
connection until each differential pair is within its configured length
tolerance. For a multi-segment match, every selected segment uses the same
tooth count, placement, and tapered profile. Invalid or impossible solver states
throw with a specific error instead of returning partially matched routes.

## Development

```sh
bun install
bun run start
bun test
bun run build
```

`bun run start` opens the interactive React Cosmos fixture playground at
`http://localhost:5000`.
