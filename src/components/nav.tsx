"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// Simple stroke icons, drawn inline so nothing is downloaded.
const ICONS: Record<string, React.ReactNode> = {
  hub: <><circle cx="12" cy="12" r="3" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /></>,
  history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  accounts: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 5.2a3.5 3.5 0 0 1 0 5.6M18.5 14.8c1.7.7 2.7 2.4 3 5.2" /></>,
}
const LINKS = [
  { href: "/", label: "Hub", icon: "hub" },
  { href: "/campaigns", label: "History", icon: "history" },
  { href: "/settings", label: "Accounts", icon: "accounts" },
]

export function Nav() {
  const path = usePathname()
  return (
    <nav className="nav">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href)
        return (
          <Link key={l.href} href={l.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[l.icon]}</svg>
            <span>{l.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
