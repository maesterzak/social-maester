import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Social Maester",
  description: "Share selected jobs and scholarships to X, Facebook, LinkedIn, Telegram, WhatsApp, Instagram and TikTok.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
