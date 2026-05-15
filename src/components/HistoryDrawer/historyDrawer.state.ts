import { createLocalStorageState, createState } from "@/lib/externalState"

export const [historyDocked$, setHistoryDocked] = createLocalStorageState(
  "history-docked",
  false,
)
export const [historyOpen$, setHistoryOpen] = createState(false)
