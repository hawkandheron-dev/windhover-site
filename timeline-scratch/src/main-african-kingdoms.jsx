import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './fonts-google.css'
import './index.css'
import AfricanKingdomsApp from './AfricanKingdomsApp.jsx'

const PUBLISHABLE_KEY = window.CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const root = document.getElementById('root')

if (!PUBLISHABLE_KEY) {
  console.warn('Missing Clerk Publishable Key — running without auth')
  createRoot(root).render(
    <StrictMode>
      <AfricanKingdomsApp />
    </StrictMode>,
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <AfricanKingdomsApp />
      </ClerkProvider>
    </StrictMode>,
  )
}
