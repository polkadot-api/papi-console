import {
  BinaryFileInput,
  checkEqualInputBinary,
} from "@/components/BinaryInput"
import { Modal } from "@/components/Modal"
import { useGenericSynchronizeInput } from "@/components/useSynchroniseInput"
import { NOTIN } from "@polkadot-api/react-builder"
import { Binary } from "@polkadot-api/substrate-bindings"
import { Download, FileUp } from "lucide-react"
import { ComponentProps, FC, useMemo, useState } from "react"
import { twMerge } from "tailwind-merge"
// @ts-expect-error save-as typings not available
import { saveAs } from "save-as"
import { BinaryEdit } from "./Icons"
import { ActionButton } from "./ActionButton"

export interface BinaryEditProps {
  initialValue?: Uint8Array
  decode: (value: Uint8Array) => unknown | NOTIN
  onValueChange: (value: any) => void
  title?: string
  fileName?: string
}

export const BinaryEditButton: FC<
  BinaryEditProps & {
    iconProps?: ComponentProps<typeof BinaryEdit>
  }
> = ({ iconProps, ...props }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <BinaryEdit
        size={24}
        {...iconProps}
        className={twMerge(
          "cursor-pointer hover:text-polkadot-500",
          iconProps?.className,
        )}
        onClick={() => setOpen(true)}
      />
      <BinaryEditModal {...props} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export const BinaryEditModal: FC<
  BinaryEditProps & {
    open: boolean
    onClose: () => void
  }
> = ({ open, ...props }) => (
  <Modal
    open={open}
    onClose={props.onClose}
    title="Edit Binary"
    className="gap-2 text-xs min-w-96 max-w-xl"
  >
    <span className="overflow-hidden text-ellipsis whitespace-nowrap">
      {props.title}
    </span>
    <BinaryEditModalContent {...props} />
  </Modal>
)

const MAX_DISPLAY_SIZE = 5 * 1024 * 1024
const BinaryEditModalContent: FC<
  BinaryEditProps & {
    onClose: () => void
  }
> = ({
  fileName,
  initialValue = new Uint8Array(),
  decode,
  onValueChange,
  onClose,
}) => {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState("")
  const [inputValue, setInputValue] = useGenericSynchronizeInput(
    value,
    setValue as any,
    (input) => parseInput(input).asBytes(),
    "" as string | Uint8Array,
    (value) => {
      if (value.length > MAX_DISPLAY_SIZE) return ""
      return Binary.fromBytes(value).asHex()
    },
    (input, value) =>
      checkEqualInputBinary(
        parseInput(input),
        value === NOTIN ? NOTIN : Binary.fromBytes(value),
      ),
  )

  const placeholder =
    value.length > MAX_DISPLAY_SIZE ? "(value is too long to display)" : ""
  const safeDecode = (value: Uint8Array) => {
    try {
      return decode(value)
    } catch (_) {
      return NOTIN
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const isValid = useMemo(() => safeDecode(value) !== NOTIN, [value, decode])
  const textareaValue = inputValue instanceof Uint8Array ? "" : inputValue

  const submit = () => {
    const decoded = safeDecode(value)
    if (decoded !== NOTIN) {
      onValueChange(decoded)
      onClose()
    } else {
      // Shouldn't happen, but it's better than just swallowing that it failed.
      setError("Couldn't set the binary data 😢")
    }
  }

  const validateFile = (file: File) => {
    if (file.size > 512 * 1024 * 1024) {
      setError("File size can't exceed 512MB")
      return false
    }
    return true
  }

  const downloadDisabled = value.length === 0
  const download = () => {
    saveAs(
      new Blob([value], {
        type: "application/octet-stream",
      }),
      `${fileName ?? new Date().toISOString()}.dat`,
    )
  }

  return (
    <>
      <div className="flex gap-4">
        <div className="flex-1 flex gap-2">
          <button
            disabled={downloadDisabled}
            className={twMerge(
              "flex items-center gap-1 hover:text-primary/80 border rounded py-1 px-2",
              downloadDisabled && "opacity-50 pointer-events-none",
            )}
            onClick={download}
          >
            <Download size={16} />
            Download
          </button>
        </div>
        <div>
          <label className="flex items-center gap-1 hover:text-primary/80 cursor-pointer border rounded py-1 px-2">
            Load file
            <FileUp size={16} />
            <BinaryFileInput
              validate={validateFile}
              onError={() => setError("Error loading file")}
              onLoaded={(value) => setValue(value.asBytes())}
            />
          </label>
        </div>
      </div>
      <div>
        <div className="text-slate-400">
          Hex data{isValid ? ` (${value.length} bytes)` : ""}
        </div>
        <textarea
          className={twMerge(
            "bg-white rounded w-full min-h-20 text-slate-950 p-1 tabular-nums border-2",
            !isValid && "border-red-600 outline-hidden",
          )}
          value={textareaValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <ActionButton onClick={submit} disabled={!isValid}>
        OK
      </ActionButton>
      {error && <p className="text-red-600">{error}</p>}
    </>
  )
}

const parseInput = (value: string | Uint8Array) =>
  value instanceof Uint8Array
    ? Binary.fromBytes(value)
    : Binary.fromHex(value.startsWith("0x") ? value : `0x${value}`)
