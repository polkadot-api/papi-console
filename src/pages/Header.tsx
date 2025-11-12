import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Link } from "@/hashParams"
import { Menu } from "lucide-react"
import { FC, PropsWithChildren, useState } from "react"
import { useLocation } from "react-router-dom"
import { twMerge } from "tailwind-merge"
import { NetworkSwitcher } from "./Network/Network"
import SliderToggle from "@/components/Toggle"
import { changeTheme, useTheme } from "@/ThemeProvider"

const navigationItems = [
  { path: "/explorer", label: "Explorer", important: true },
  { path: "/storage", label: "Storage", important: true },
  { path: "/extrinsics", label: "Extrinsics", important: true },
  { path: "/constants", label: "Constants", important: false },
  { path: "/runtimeCalls", label: "Runtime Calls", important: true },
  { path: "/accounts", label: "Accounts", important: false },
]

export const Header = () => {
  const [open, setIsOpen] = useState(false)

  return (
    <div className="shrink-0 border-b">
      <div className="flex p-4 pb-2 items-center gap-2 max-w-(--breakpoint-xl) m-auto">
        <div className="flex items-center flex-row gap-2 relative mr-2">
          <img
            className="w-14 min-w-14 hidden dark:inline-block"
            src="/papi_logo-dark.svg"
            alt="papi-logo"
          />
          <img
            className="w-14 min-w-14 dark:hidden"
            src="/papi_logo-light.svg"
            alt="papi-logo"
          />
          <h1 className="hidden min-[72rem]:block poppins-regular text-lg">
            papi <span className="poppins-extralight">console</span>
          </h1>
          <div className="absolute -bottom-1 left-0 min-[72rem]:bottom-0 min-[72rem]:right-1 text-right text-sm">
            (beta)
          </div>
        </div>
        <NetworkSwitcher />
        <div className="flex-1" />
        <nav className="flex flex-row items-center justify-end px-1 py-1 text-nowrap flex-wrap min-w-56">
          {navigationItems.map(({ path, label, important }) => (
            <NavLink
              to={path}
              key={path}
              className={
                important ? "text-sm sm:text-base" : "hidden lg:inline-block"
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <Sheet open={open} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-accent"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-background w-64 pt-10">
            <NetworkSwitcher forSmallScreen />
            <nav className="flex flex-col gap-4 lg:hidden">
              {navigationItems
                .filter(({ important }) => !important)
                .map(({ path, label }) => (
                  <NavLink
                    to={path}
                    key={path}
                    onClick={() => setIsOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}
            </nav>
            <NavLink to="/viewFns" onClick={() => setIsOpen(false)}>
              View Functions
            </NavLink>
            <NavLink to="/metadata" onClick={() => setIsOpen(false)}>
              Metadata
            </NavLink>
            <NavLink to="/rpcCalls" onClick={() => setIsOpen(false)}>
              RPC Calls
            </NavLink>
            <hr />
            <ThemeToggle />
            <div className="grow" />
            <div className="border-t p-2 text-right">
              <a
                href="https://github.com/polkadot-api/papi-console"
                target="_blank"
              >
                github
              </a>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}

const NavLink: FC<
  PropsWithChildren<{ to: string; onClick?: () => void; className?: string }>
> = ({ to, children, className, onClick }) => {
  const location = useLocation()
  const active = location.pathname.startsWith(to)

  return (
    <Link
      to={to}
      className={twMerge(
        "transition-colors text-foreground/75 hover:text-foreground cursor-pointer px-3 py-1 rounded",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        active && "text-foreground font-bold",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

const ThemeToggle = () => {
  const theme = useTheme()

  return (
    <label className="flex items-center justify-between px-4">
      <div>Dark mode</div>
      <SliderToggle
        isToggled={theme === "dark"}
        toggle={() => changeTheme(theme === "dark" ? "light" : "dark")}
      />
    </label>
  )
}
