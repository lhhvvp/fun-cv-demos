import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Video Editor - Professional Web-Based Editing',
  description: 'A production-ready video editor built with Next.js, React, and FFmpeg',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  )
}
