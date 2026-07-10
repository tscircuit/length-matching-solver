import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error('Vite entrypoint could not find the root element with id "root"')
}

createRoot(rootElement).render(
  <StrictMode>
    <p>Run React Cosmos with `bun run start` to open solver fixtures.</p>
  </StrictMode>,
)
