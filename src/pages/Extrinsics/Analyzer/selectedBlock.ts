import { state } from "@react-rxjs/core"
import { map } from "rxjs"
import { selectedBlock$ } from "../../Storage/BlockPicker"

export { selectedBlock$ }
export const selectedBlockHex$ = state(selectedBlock$.pipe(map((v) => v.hash)))
