import { Nav } from "@/components/nav"

// The tool itself (the public share pages under /s use the bare root layout).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="brand"><span className="brand-dot" /> Social Maester</div>
        <Nav />
      </header>
      <main>{children}</main>
    </>
  )
}
