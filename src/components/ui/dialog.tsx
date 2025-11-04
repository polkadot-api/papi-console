import { cn } from "@/lib/utils"
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@polkahub/ui-components"

export function DialogBody({
  children,
  id,
  className,
}: React.PropsWithChildren<{ id?: string; className?: string }>) {
  return (
    <div className={cn("overflow-auto px-6 py-2 last:pb-6", className)} id={id}>
      {children}
    </div>
  )
}
