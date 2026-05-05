import { createContext } from "react"
import { BlockInfo } from "../block.state"

export const BlockContext = createContext<BlockInfo | null>(null)
