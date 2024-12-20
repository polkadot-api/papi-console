import { RemoveSubscribe, Subscribe } from "@react-rxjs/core"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { merge } from "rxjs"
import App from "./App.tsx"
import { dynamicBuilder$ } from "@/state/chains/chain.state"
import "./index.css"
import { explorer$ } from "./pages/Explorer"
import { transactions$ } from "./pages/Transactions"
import { ThemeProvider } from "./ThemeProvider.tsx"
import { TooltipProvider } from "./components/ui/tooltip.tsx"

createRoot(document.getElementById("root")!).render(
  <Subscribe source$={merge(dynamicBuilder$, explorer$, transactions$)}>
    <RemoveSubscribe>
      <StrictMode>
        <ThemeProvider>
          <BrowserRouter>
            <TooltipProvider delayDuration={500}>
              <App />
            </TooltipProvider>
          </BrowserRouter>
        </ThemeProvider>
      </StrictMode>
    </RemoveSubscribe>
  </Subscribe>,
)
