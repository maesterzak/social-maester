import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Social Maester",
  description: "Share selected jobs and scholarships to X, Facebook, LinkedIn, Telegram, WhatsApp, Instagram, TikTok and YouTube.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme is set before paint from this browser's choice, so the attribute can differ from the server's.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('sm-theme')==='paper')document.documentElement.dataset.theme='paper'}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
