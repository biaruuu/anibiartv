import type { Metadata } from "next"
import { Poppins } from "next/font/google"

import "./globals.css"

// Exposes --font-poppins, which the video player uses for captions, title and time.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Video Player",
  description: "A responsive video player built with shadcn/ui",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
