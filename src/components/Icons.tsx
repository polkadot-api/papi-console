import { useTheme } from "@/ThemeProvider"
import { LookupEntry } from "@polkadot-api/metadata-builders"
import {
  Ban,
  Binary,
  Braces,
  CircleHelp,
  Copy,
  Hash,
  List,
  LoaderCircle,
  LucideProps,
  User,
} from "lucide-react"
import { FC, useEffect, useRef } from "react"
import { Props, ReactSVG } from "react-svg"
import { twMerge } from "tailwind-merge"
import binarySvg from "./icons/binary.svg"
import chopsticksLogoDark from "./icons/chopsticks_dark.svg"
import chopsticksLogoLight from "./icons/chopsticks_light.svg"
import enumSvg from "./icons/enum.svg"
import focusSvg from "./icons/focus.svg"
import walletConnectSvg from "./icons/walletConnect.svg"

type CustomIconProps = Omit<Props, "ref" | "src"> & { size?: number }
const CustomIcon: FC<
  CustomIconProps & {
    url: string
  }
> = ({ size = 16, url, ...props }) => {
  const ref = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.setAttribute("width", String(size))
    ref.current.setAttribute("height", String(size))
  }, [size])

  return (
    <ReactSVG
      {...props}
      src={url}
      beforeInjection={(svg) => {
        ref.current = svg
        svg.setAttribute("width", String(size))
        svg.setAttribute("height", String(size))
      }}
    />
  )
}

const customIcon = (url: string) => (props: CustomIconProps) => (
  <CustomIcon url={url} {...props} />
)

const themeIcon = (light: string, dark: string) => (props: CustomIconProps) => {
  const theme = useTheme()
  return <CustomIcon url={theme === "light" ? light : dark} {...props} />
}

export const Focus = customIcon(focusSvg)
export const Enum = customIcon(enumSvg)
export const BinaryEdit = customIcon(binarySvg)
export const WalletConnect = customIcon(walletConnectSvg)
export const Chopsticks = themeIcon(chopsticksLogoLight, chopsticksLogoDark)

export const Spinner = (props: LucideProps) => (
  <LoaderCircle
    {...props}
    className={twMerge("animate-spin", props.className)}
  />
)

export const TypeIcons = {
  list: List,
  enum: Enum,
  primitive: Hash,
  binary: Binary,
  account: User,
  object: Braces,
  maybe: CircleHelp,
  void: Ban,
}
export type TypeIcon = keyof typeof TypeIcons

export const lookupToType: Record<LookupEntry["type"], TypeIcon> = {
  primitive: "primitive",
  void: "void",
  compact: "primitive",
  bitSequence: "binary",
  AccountId32: "account",
  AccountId20: "account",
  tuple: "list",
  struct: "object",
  sequence: "list",
  array: "list",
  option: "maybe",
  result: "maybe",
  enum: "enum",
}

export const CopyBinaryIcon = ({ size = 16, ...props }: CustomIconProps) => (
  <svg
    width={size}
    height={size}
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <Copy className="text-current" />
    <text
      x="15"
      y="14.5"
      fontSize="9"
      fill="currentColor"
      className="font-mono font-bold"
      textAnchor="middle"
      dominantBaseline="central"
    >
      0x
    </text>
  </svg>
)
