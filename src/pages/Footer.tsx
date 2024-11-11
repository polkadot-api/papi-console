import { Link } from "react-router-dom"
import { twMerge } from "tailwind-merge"

export const Footer = () => (
  <div className="bg-background flex p-4 items-center flex-shrink-0 gap-2 border-b border-t justify-between bottom-0 relative">
    <div>{/* Theme */}</div>
    <div>polkadot-api © {new Date().getFullYear()}</div>
    <Link
      to={"https://github.com/polkadot-api/papi-console"}
      target="_blank"
      className={twMerge(
        "transition-colors text-foreground/75 hover:text-foreground cursor-pointer px-3 py-1 rounded",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <img
        className="w-7 min-w-7 hidden dark:inline-block bg-white hover:bg-[#E6007a] rounded-xl"
        src="/github-light.svg"
        alt="papi-logo"
      />
      <img
        className="w-7 min-w-7 inline-block dark:hidden hover:bg-[#E6007a] rounded-xl"
        src="/github-dark.svg"
        alt="papi-logo"
      />
    </Link>
  </div>
)
