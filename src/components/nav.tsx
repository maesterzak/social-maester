"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/", label: "Post" },
  { href: "/campaigns", label: "History" },
  { href: "/settings", label: "Accounts" },
]

export function Nav() {
  const path = usePathname()
  return (
    <nav className="nav">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href)
        return <Link key={l.href} href={l.href} className={active ? "active" : ""}>{l.label}</Link>
      })}
    </nav>
  )
}
