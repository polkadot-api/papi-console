import { BinaryEditModal } from "@/components/BinaryEditButton"
import { BinaryEdit, Focus, TypeIcon, TypeIcons } from "@/components/Icons"
import {
  EditAccountId,
  EditBigNumber,
  EditBitSeq,
  EditBool,
  EditBytes,
  EditEthAccount,
  EditNumber,
  EditOption,
  EditPrimitiveComponentProps,
  EditResult,
  EditStr,
  EditVoid,
  NOTIN,
} from "@polkadot-api/react-builder"
import { HexString } from "@polkadot-api/substrate-bindings"
import { useStateObservable } from "@react-rxjs/core"
import { Circle } from "lucide-react"
import {
  createContext,
  FC,
  PropsWithChildren,
  ReactElement,
  useContext,
  useLayoutEffect,
  useState,
} from "react"
import { twMerge } from "tailwind-merge"
import { isActive$, PathsRoot, setHovered } from "../../common/paths.state"

export const CVoid: EditVoid = () => null

const CPrimitive: FC<EditPrimitiveComponentProps<any>> = ({
  type,
  encodedValue,
  onValueChanged,
  decode,
}) => {
  useReportBinaryStatus(type, encodedValue, onValueChanged, decode)
  return null
}
export const CBool: EditBool = CPrimitive
export const CStr: EditStr = CPrimitive
export const CEthAccount: EditEthAccount = CPrimitive
export const CBigNumber: EditBigNumber = CPrimitive
export const CNumber: EditNumber = CPrimitive
export const CAccountId: EditAccountId = CPrimitive
export const CBytes: EditBytes = CPrimitive
export const CBitSeq: EditBitSeq = CPrimitive

export const COption: EditOption = ({
  value,
  inner,
  type,
  encodedValue,
  onValueChanged,
  decode,
}) => {
  useReportBinaryStatus(type, encodedValue, onValueChanged, decode)

  return value === undefined ? null : (
    <BinaryStatusContext.Provider value={() => {}}>
      {inner}
    </BinaryStatusContext.Provider>
  )
}

export const CResult: EditResult = ({ value, inner }) => (
  <>
    {value !== NOTIN && (value.success ? "ok" : "ko")}-{inner}
  </>
)

export const ItemMarker = () => (
  <span className="w-[0.77rem] border-t border-tree-border"></span>
)

export const TitleContext = createContext<HTMLElement | null>(null)

export type BinaryStatus = {
  type: "blank" | "partial" | "complete"
  encodedValue: Uint8Array | undefined
  onValueChanged: (value: any | NOTIN) => boolean
  decode: (value: Uint8Array | HexString) => any | NOTIN
}
export const BinaryStatusContext = createContext<
  (status: BinaryStatus) => void
>(() => {})

export const useReportBinaryStatus = (
  type: "blank" | "partial" | "complete",
  encodedValue: Uint8Array | undefined,
  onValueChanged: (value: any | NOTIN) => boolean,
  decode: (value: Uint8Array | HexString) => any | NOTIN,
) => {
  const onBinChange = useContext(BinaryStatusContext)
  useLayoutEffect(
    () => onBinChange({ type, encodedValue, onValueChanged, decode }),
    [type, encodedValue, onValueChanged, decode, onBinChange],
  )
}

export const ChildrenProviders: FC<
  PropsWithChildren<{
    onValueChange: (status: BinaryStatus) => void
    titleElement: HTMLElement | null
  }>
> = ({ onValueChange, titleElement, children }) => (
  <TitleContext.Provider value={titleElement}>
    <BinaryStatusContext.Provider value={onValueChange}>
      {children}
    </BinaryStatusContext.Provider>
  </TitleContext.Provider>
)

export const ItemTitle: FC<
  PropsWithChildren<{
    path: string
    icon: (typeof TypeIcons)[TypeIcon]
    binaryStatus?: BinaryStatus
    onNavigate?: () => void
    titleRef?: (element: HTMLDivElement) => void
    onZoom?: () => void
    actions?: ReactElement
    className?: string
  }>
> = ({
  children,
  path,
  icon: Icon,
  binaryStatus,
  titleRef,
  onNavigate,
  onZoom,
  actions,
  className,
}) => {
  const [binaryOpen, setBinaryOpen] = useState(false)
  const isActive = useStateObservable(isActive$(path))
  const pathId = useContext(PathsRoot)

  return (
    <>
      <div
        className={twMerge(
          "flex items-center h-8",
          isActive && "bg-secondary/80",
          className,
        )}
        data-marker={`marker-${path}`}
        onMouseEnter={() => setHovered(pathId, { id: path, hover: true })}
        onMouseLeave={() => setHovered(pathId, { id: path, hover: false })}
      >
        <span
          className={twMerge(
            "hover:text-primary shrink-0 flex items-center",
            onNavigate && "cursor-pointer",
          )}
          onClick={onNavigate}
        >
          <ItemMarker />
          <Circle
            size={8}
            strokeWidth={3}
            className={twMerge(
              "mx-2",
              binaryStatus?.type === "blank" && "text-red-500",
              binaryStatus?.type === "partial" && "text-yellow-400",
              binaryStatus?.type === "complete" && "text-polkadot-600",
              binaryStatus === undefined && "text-slate-600",
            )}
          />
          <Icon size={15} className="text-primary mr-2" />
          {children}
        </span>
        <div
          ref={titleRef}
          className="flex flex-1 ml-1 flex-wrap leading-none"
        />
        <div className="visible_when_parent_hover px-1 flex gap-1.5 items-center">
          {onZoom && binaryStatus && (
            <BinaryEdit
              size={24}
              className={twMerge("cursor-pointer hover:text-polkadot-500")}
              onClick={() => setBinaryOpen(true)}
            />
          )}
          {onZoom && (
            <Focus
              size={15}
              className="cursor-pointer hover:text-polkadot-500"
              onClick={onZoom}
            />
          )}
          {actions}
        </div>
      </div>
      {binaryStatus && (
        <TreeBinaryEditModal
          status={binaryStatus}
          open={binaryOpen}
          path={path}
          onClose={() => setBinaryOpen(false)}
        />
      )}
    </>
  )
}

const TreeBinaryEditModal: FC<{
  status: BinaryStatus
  open: boolean
  path: string
  onClose: () => void
}> = ({ status, path, open, onClose }) => (
  <BinaryEditModal
    decode={status.decode}
    onClose={onClose}
    open={open}
    onValueChange={status.onValueChanged}
    fileName={path.replace(/\./g, "__") || "root"}
    initialValue={status.encodedValue}
    title={path}
  />
)
