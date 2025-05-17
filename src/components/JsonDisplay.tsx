import { bytesToString } from "@/components/BinaryInput"
import { Binary } from "@polkadot-api/substrate-bindings"
import { FC } from "react"
import ReactJson from "react18-json-view"
import "react18-json-view/src/dark.css"
import "react18-json-view/src/style.css"
import "./jsonDisplay.css"
import { useTheme } from "@/ThemeProvider"

export const JsonDisplay: FC<{
  src: unknown
  collapsed?: boolean | number
}> = ({ src, ...props }) => {
  const theme = useTheme()

  return (
    <ReactJson
      src={src}
      dark={theme === "dark"}
      theme="a11y"
      replacer={(v) => (v instanceof Binary ? bytesToString(v) : v)}
      customizeCopy={(v) =>
        JSON.stringify(
          v,
          (_, v) =>
            typeof v === "bigint"
              ? `${v}n`
              : v instanceof Binary
                ? bytesToString(v)
                : v,
          2,
        )
      }
      {...props}
    />
  )
}
