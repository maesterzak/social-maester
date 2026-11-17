"use client"

import { useEffect, useState } from "react"

// Studio (dark, the default) or Paper (light). Remembered in this browser only.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"studio" | "paper" | null>(null)
  useEffect(() => { setTheme(document.documentElement.dataset.theme === "paper" ? "paper" : "studio") }, [])
  function flip() {
    const next = theme === "paper" ? "studio" : "paper"
    document.documentElement.dataset.theme = next
    try { localStorage.setItem("sm-theme", next) } catch { /* private mode: just not remembered */ }
    setTheme(next)
  }
  return (
    <button type="button" className="theme-toggle" onClick={flip} aria-label="Switch light or dark look" disabled={!theme}>
      <span aria-hidden="true">{theme === "paper" ? "☾" : "☀"}</span> {theme === "paper" ? "Studio look" : "Paper look"}
    </button>
  )
}
