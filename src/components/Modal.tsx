import { XSquare } from "lucide-react"
import {
  FC,
  PropsWithChildren,
  ReactNode,
  createContext,
  useEffect,
  useState,
} from "react"
import { Portal } from "react-portal"
import { twMerge } from "tailwind-merge"
import "./modal.css"

export type ModalProps = PropsWithChildren<{
  title?: ReactNode
  open?: boolean
  // On some cases you have to disable this (e.g. when using non-native select boxes, those popups will go under the native dialog)
  useNative?: boolean
  onClose?: () => void
  className?: string
}>

export const ModalRefContext = createContext<HTMLElement | null>(null)

export const Modal: FC<ModalProps> = ({
  title,
  open,
  children,
  useNative = true,
  onClose,
  className,
}) => {
  const [ref, setRef] = useState<HTMLDialogElement | null>(null)
  const isDialogCompatible =
    useNative &&
    Boolean(typeof window === "undefined" || globalThis.HTMLDialogElement)

  useEffect(() => {
    if (!ref) return
    if (ref.open && !open) {
      ref.close()
    } else if (!ref.open && open) {
      // Not sure why, having this run in a useEffect (or useLayoutEffect) causes
      // an issue: on EditCodec+Tree, when hovering over a line of the tree view
      // and pressing on "Edit binary", the modal causes the `mouseleave` event
      // to not trigger, so the line becomes "Active" (and the binary view shows
      // highlight of something not being hovered on).
      // Seems that if `.showModal()` is called synchronously it doesn't happen.
      // It doesn't happen if `.showModal()` is called in a setTimeout.
      // But within a useEffect, the issue is present.
      let canceled = false
      setTimeout(() => {
        if (canceled) {
          return
        }
        ref.showModal()
      })
      return () => {
        canceled = true
      }
    }
  }, [open, ref])

  usePreventBodyScroll(open)
  const showContent = usePersistOpen(open)

  const content = showContent ? (
    <ModalContent title={title} onClose={onClose} className={className}>
      {children}
    </ModalContent>
  ) : null

  if (isDialogCompatible) {
    return (
      <dialog
        className="modal rounded backdrop:backdrop-blur-[2px] backdrop:backdrop-contrast-75 flex flex-col overflow-hidden border-popover-foreground bg-popover text-popover-foreground"
        ref={setRef}
        onClose={onClose}
      >
        <ModalRefContext.Provider value={ref}>
          {content}
        </ModalRefContext.Provider>
      </dialog>
    )
  }

  return (
    <Portal node={document.body}>
      <ModalPolyfill open={open} onClose={onClose}>
        {content}
      </ModalPolyfill>
    </Portal>
  )
}

const ModalPolyfill: FC<ModalProps> = ({ open, children, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") onClose?.()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  if (!open) return null

  return (
    <div
      className="z-50 fixed left-0 top-0 w-full h-full backdrop-blur-[1px] bg-background/10 flex items-center justify-center overflow-hidden"
      onScroll={(evt) => {
        evt.stopPropagation()
        evt.preventDefault()
      }}
    >
      <div className="modal rounded bg-popover text-popover-foreground flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}

const ModalContent: FC<
  PropsWithChildren<{
    title?: ReactNode
    onClose?: () => void
    className?: string
  }>
> = ({ title, onClose, children, className }) => (
  <>
    <div className="px-2 py-1 border-b flex overflow-hidden min-w-[10rem] shrink-0">
      <div className="flex-1 flex font-bold">{title}</div>
      <button
        type="button"
        className="shrink-0 text-card-foreground/70 "
        onClick={onClose}
      >
        <XSquare />
      </button>
    </div>
    <div className={twMerge("p-2 flex flex-col overflow-auto", className)}>
      {children}
    </div>
  </>
)

const usePreventBodyScroll = (open?: boolean) =>
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [open])

// Persists the `open` property to let the modal animate out before removing the children.
const usePersistOpen = (open?: boolean) => {
  const [persist, setPersist] = useState(Boolean(open))

  useEffect(() => {
    if (open) {
      setPersist(true)
    } else {
      const token = setTimeout(() => setPersist(false), 500)
      return () => clearTimeout(token)
    }
  }, [open])

  return open || persist
}
