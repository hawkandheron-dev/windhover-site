import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import ChurchHistory2App from './ChurchHistory2App.jsx'

// ChurchHistory2App renders its Clerk-aware branch — and so calls useAuth —
// whenever a publishable key is present, which only works inside a provider.
// The condition below has to stay identical to `hasClerk` in that file, or the
// two disagree about which branch is live and the app throws on first render.
const PUBLISHABLE_KEY = window.CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const root = document.getElementById('root')

if (!PUBLISHABLE_KEY) {
  console.warn('Missing Clerk Publishable Key — running without auth')
  createRoot(root).render(
    <StrictMode>
      <ChurchHistory2App />
    </StrictMode>,
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <ChurchHistory2App />
      </ClerkProvider>
    </StrictMode>,
  )
}
