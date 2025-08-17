import '@coinbase/onchainkit/styles.css'
import type React from "react"
import type { Metadata } from "next"
import { Playfair_Display, Source_Sans_3 as Source_Sans_Pro } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from './providers'

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
  weight: ["400", "700"],
})

const sourceSans = Source_Sans_Pro({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "600"],
})

export const metadata: Metadata = {
  title: "DegenGuard - DeFi Portfolio Monitor",
  description: "AI-powered DeFi wallet monitoring and protection system",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${sourceSans.variable} dark`}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}
