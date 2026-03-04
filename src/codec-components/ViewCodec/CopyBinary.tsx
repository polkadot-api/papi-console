import { CopyText } from "@/components/Copy"
import { Binary } from "polkadot-api"
import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react"
import { noop } from "rxjs"
import { twMerge } from "tailwind-merge"

const CopyBinaryContext = createContext<{
  value: Uint8Array | null
  setValue: (value: Uint8Array) => void
}>({
  value: null,
  setValue: noop,
})

export const CopyBinaryProvider: FC<PropsWithChildren> = ({ children }) => {
  const [value, setValue] = useState<Uint8Array | null>(null)

  return (
    <CopyBinaryContext.Provider
      value={{
        value,
        setValue,
      }}
    >
      {children}
    </CopyBinaryContext.Provider>
  )
}

export const useReportBinary = (value: Uint8Array) => {
  const { setValue } = useContext(CopyBinaryContext)
  useEffect(() => setValue(value), [setValue, value])
}

export const CopyChildBinary: FC<{ visible?: boolean }> = ({ visible }) => {
  const { value } = useContext(CopyBinaryContext)

  return (
    <CopyBinary
      value={value ?? new Uint8Array()}
      visible={visible && !!value}
    />
  )
}

export const CopyBinary: FC<{ value: Uint8Array; visible?: boolean }> = ({
  value,
  visible = true,
}) => (
  <CopyText
    text={Binary.fromBytes(value).asHex()}
    className={twMerge("transition-opacity", !visible ? "opacity-0" : "")}
    binary
  />
)
