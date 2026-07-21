import { Analytics } from '@vercel/analytics/next'
import { Inter } from 'next/font/google'
import './globals.css'

const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata = {
  title: 'Leafy Wallet · MongoDB Demo',
  description: 'An offline-first wallet, powered by MongoDB.',
}

export const viewport = {
  themeColor: '#001e2b',
}

/** Root HTML document: loads brand fonts, sets metadata/theme-color, and mounts analytics in production. */
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={fontSans.variable}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
