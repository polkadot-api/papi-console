import { CopyText as GenericCopyText } from "@polkadot-api/react-components"
import { CheckCircle, Copy } from "lucide-react"
import { PropsWithChildren } from "react"
import { twMerge } from "tailwind-merge"
import { CopyBinaryIcon } from "./Icons"

export const CopyText: React.FC<
  PropsWithChildren<{
    text: string
    size?: number
    disabled?: boolean
    className?: string
    binary?: boolean
  }>
> = ({ text, className, children, binary, disabled, size = 16 }) => {
  return (
    <GenericCopyText
      className={twMerge(
        className,
        disabled ? "opacity-50 pointer-events-none" : "",
      )}
      text={text}
      copiedIndicator={
        <CheckCircle
          size={size}
          className="text-green-500 dark:text-green-300"
        />
      }
    >
      {children ?? (binary ? <CopyBinaryIcon size={16} /> : <Copy size={16} />)}
    </GenericCopyText>
  )
}
