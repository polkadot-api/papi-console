import { RemoveSubscribe, Subscribe } from "@react-rxjs/core"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { merge } from "rxjs"
import App from "./App.tsx"
import { dynamicBuilder$, persistSyncState$ } from "./chain.state.ts"
import { TooltipProvider } from "./components/Tooltip.tsx"
import "./index.css"
import { explorer$ } from "./pages/Explorer"
import { transactions$ } from "./pages/Transactions"
import { ThemeProvider } from "./ThemeProvider.tsx"

createRoot(document.getElementById("root")!).render(
  <Subscribe
    source$={merge(
      dynamicBuilder$,
      explorer$,
      transactions$,
      persistSyncState$,
    )}
  >
    <RemoveSubscribe>
      <StrictMode>
        <ThemeProvider>
          <BrowserRouter>
            <TooltipProvider>
              <App />
            </TooltipProvider>
          </BrowserRouter>
        </ThemeProvider>
      </StrictMode>
    </RemoveSubscribe>
  </Subscribe>,
)
