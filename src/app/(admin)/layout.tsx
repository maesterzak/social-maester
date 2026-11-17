import { Nav } from "@/components/nav"
import { ThemeToggle } from "@/components/theme-toggle"

// The tool itself (the public share pages under /s use the bare root layout).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand"><span className="brand-mark" /> Social Maester</div>
        <Nav />
        <div className="rail-foot"><ThemeToggle /><div>Content hub for <b>PathMaester</b>. Every opportunity, sent to the people it is for.</div></div>
      </aside>
      <main>{children}</main>
    </div>
  )
}
