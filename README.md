# @tscircuit/differential-pairs-solver

Standalone differential-pair length matching for routed PCB traces.

```ts
import { LengthMatchingSolver } from "@tscircuit/differential-pairs-solver"

const solver = new LengthMatchingSolver({
  hdRoutes,
  originalConnections,
  differentialPairs,
})

solver.solve()
const { matchedHdRoutes } = solver.getOutput()
```

The solver adds obstacle-aware square-wave meanders to the shorter connection
until each differential pair is within its configured length tolerance. Invalid
or impossible solver states throw with a specific error instead of returning
partially matched routes.

## Development

```sh
bun install
bun run start
bun test
bun run build
```

`bun run start` opens the interactive React Cosmos fixture playground at
`http://localhost:5000`.
