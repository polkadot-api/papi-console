import SliderToggle from "@/components/Toggle"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Link, useNavigate } from "@/hashParams"
import { changeTheme, useTheme } from "@/ThemeProvider"
import {
  Blocks,
  Code2,
  Database,
  FileCode2,
  FileText,
  Menu,
  RadioTower,
  Search,
  Send,
  Wallet,
} from "lucide-react"
import { FC, FormEvent, PropsWithChildren, useState } from "react"
import { useLocation } from "react-router-dom"
import { twMerge } from "tailwind-merge"
import { NetworkSwitcher } from "./Network/Network"

type NavigationItem = {
  path: string
  label: string
  icon: FC<{ size?: number; className?: string }>
}

const navigationGroups: Array<{
  label: string
  items: NavigationItem[]
}> = [
  {
    label: "Tools",
    items: [
      { path: "/explorer", label: "Explorer", icon: Blocks },
      { path: "/storage", label: "Storage", icon: Database },
      { path: "/extrinsics", label: "Extrinsics", icon: Send },
      { path: "/runtimeCalls", label: "Runtime Calls", icon: Code2 },
      { path: "/viewFns", label: "View Functions", icon: FileCode2 },
      { path: "/constants", label: "Constants", icon: FileText },
      { path: "/metadata", label: "Metadata", icon: Blocks },
      { path: "/rpcCalls", label: "RPC Calls", icon: RadioTower },
    ],
  },
  {
    label: "Utils",
    items: [{ path: "/accounts", label: "Accounts", icon: Wallet }],
  },
]

const navigationItems = navigationGroups.flatMap((group) => group.items)

export const AppShell: FC<PropsWithChildren> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r bg-card/30 lg:flex">
        <SidebarContent />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 bg-background p-0">
          <SidebarContent onNavigate={() => setSidebarOpen(false)} mobile />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="relative min-h-0 flex-1 overflow-auto">
          <div className="mx-auto h-full w-full max-w-(--breakpoint-xl)">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

const SidebarContent: FC<{ mobile?: boolean; onNavigate?: () => void }> = ({
  mobile,
  onNavigate,
}) => (
  <div className="flex h-full w-full flex-col">
    <div className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
      <img
        className="h-10 w-10 shrink-0 hidden dark:inline-block"
        src="/papi_logo-dark.svg"
        alt="papi logo"
      />
      <img
        className="h-10 w-10 shrink-0 dark:hidden"
        src="/papi_logo-light.svg"
        alt="papi logo"
      />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-base">
          <span className="poppins-regular">papi</span>{" "}
          <span className="poppins-extralight">console</span>
        </div>
        <div className="text-xs text-muted-foreground">beta</div>
      </div>
    </div>
    {mobile ? (
      <div className="border-b px-3 py-3">
        <NetworkSwitcher className="flex w-full md:hidden" />
      </div>
    ) : null}
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {navigationGroups.map((group) => (
        <div key={group.label} className="mb-5 last:mb-0">
          <div className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => (
              <SidebarLink key={item.path} item={item} onClick={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
    <div className="shrink-0 border-t p-3">
      <ThemeToggle />
      <a
        href="https://github.com/polkadot-api/papi-console"
        target="_blank"
        rel="noreferrer"
        className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <FileCode2 size={16} />
        GitHub
      </a>
    </div>
  </div>
)

const TopBar: FC<{ onOpenSidebar: () => void }> = ({ onOpenSidebar }) => {
  return (
    <header className="flex h-16 shrink-0 items-center border-b bg-background/95 px-3 lg:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="mr-2 shrink-0 text-foreground hover:bg-accent lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1 flex gap-4 justify-between">
        <div className="ml-3 hidden sm:block">
          <NetworkSwitcher className="w-55" />
        </div>
        <GlobalJumpSearch />
      </div>
    </header>
  )
}

const GlobalJumpSearch = () => {
  const navigate = useNavigate()
  const [value, setValue] = useState("")

  const handleSubmit = (evt: FormEvent) => {
    evt.preventDefault()

    const target = getJumpTarget(value)
    if (!target) return

    navigate(target)
    setValue("")
  }

  return (
    <form className="max-w-2xl flex-1" onSubmit={handleSubmit}>
      <label className="flex h-9 items-center gap-2 rounded-md border bg-input px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
        <Search size={16} className="shrink-0 text-muted-foreground" />
        <input
          value={value}
          onChange={(evt) => setValue(evt.target.value)}
          className="flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground"
          placeholder="Jump to block, hash, or section"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
    </form>
  )
}

const SidebarLink: FC<{ item: NavigationItem; onClick?: () => void }> = ({
  item,
  onClick,
}) => {
  const location = useLocation()
  const active = isNavigationItemActive(location.pathname, item.path)
  const Icon = item.icon

  return (
    <Link
      to={item.path}
      aria-current={active ? "page" : undefined}
      className={twMerge(
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
        "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent text-accent-foreground font-medium",
      )}
      onClick={onClick}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

const isNavigationItemActive = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`)

const getJumpTarget = (value: string) => {
  const query = value.trim()
  if (!query) return null

  if (query.startsWith("/")) return query

  const normalizedQuery = normalizeLabel(query)
  const exactSection = navigationItems.find(
    ({ label }) => normalizeLabel(label) === normalizedQuery,
  )
  if (exactSection) return exactSection.path

  const matchingSection = navigationItems.find(({ label }) =>
    normalizeLabel(label).startsWith(normalizedQuery),
  )
  if (matchingSection) return matchingSection.path

  if (/^(0x[0-9a-f]+|\d+)$/i.test(query)) {
    return `/explorer/${query}`
  }

  return null
}

const normalizeLabel = (value: string) =>
  value.toLowerCase().replace(/[\s_-]/g, "")

const ThemeToggle = () => {
  const theme = useTheme()

  return (
    <label className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground">
      <span>Dark mode</span>
      <SliderToggle
        isToggled={theme === "dark"}
        toggle={() => changeTheme(theme === "dark" ? "light" : "dark")}
      />
    </label>
  )
}
