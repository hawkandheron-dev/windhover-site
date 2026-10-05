import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './fonts-google.css'
import './index.css'
import HistoricalErasApp from './HistoricalErasApp.jsx'

const PUBLISHABLE_KEY = window.CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const root = document.getElementById('root')

if (!PUBLISHABLE_KEY) {
  console.error('Missing Clerk Publishable Key')
  if (root) {
    root.innerHTML = '<div style="padding:16px;font-family:system-ui">Missing Clerk Publishable Key (set VITE_CLERK_PUBLISHABLE_KEY).</div>'
  }
} else {
  createRoot(root).render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <HistoricalErasApp />
      </ClerkProvider>
    </StrictMode>,
  )
}
