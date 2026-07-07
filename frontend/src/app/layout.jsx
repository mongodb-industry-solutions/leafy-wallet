import { Analytics } from '@vercel/analytics/next'
import { Plus_Jakarta_Sans, Source_Serif_4, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const fontSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' })
const fontSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif' })
const fontMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

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
    <html
      lang="en"
      className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable}`}
    >
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
