import { dynamicBuilder$ } from "@/state/chains/chain.state"
import { RemoveSubscribe, Subscribe } from "@react-rxjs/core"
import { MultisigExternalSignerModal, PolkaHubProvider } from "polkahub"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { merge } from "rxjs"
import App from "./App.tsx"
import { TooltipProvider } from "./components/ui/tooltip.tsx"
import "./index.css"
import { explorer$ } from "./pages/Explorer"
import { polkaHub } from "./state/polkahub.ts"
import { ThemeProvider } from "./ThemeProvider.tsx"

createRoot(document.getElementById("root")!).render(
  <Subscribe source$={merge(dynamicBuilder$, explorer$)}>
    <RemoveSubscribe>
      <StrictMode>
        <ThemeProvider>
          <PolkaHubProvider polkaHub={polkaHub}>
            <BrowserRouter>
              <TooltipProvider delayDuration={500}>
                <App />
              </TooltipProvider>
            </BrowserRouter>
            <MultisigExternalSignerModal />
          </PolkaHubProvider>
        </ThemeProvider>
      </StrictMode>
    </RemoveSubscribe>
  </Subscribe>,
)
