import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import "@fontsource-variable/karla"
import "@fontsource/poppins/400.css"
import "@fontsource/poppins/500.css"
import "@fontsource/poppins/600.css"
import "@fontsource/poppins/700.css"
import "@fontsource/open-sans/600.css"
import "@fontsource/open-sans/700.css"

import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"
import { BottomNav } from "@/components/bottom-nav"
import { DesktopSiteNotice } from "@/components/desktop-site-notice"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: {
    default: "AniBiar TV",
    template: "%s | AniBiar TV",
  },
  description:
    "Watch anime with a modern glass-style player, Poppins captions and volume boost.",
  applicationName: "AniBiar TV",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          forcedTheme="dark"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <BottomNav />
          </AuthProvider>
          <DesktopSiteNotice />
        </ThemeProvider>
      </body>
    </html>
  )
}
