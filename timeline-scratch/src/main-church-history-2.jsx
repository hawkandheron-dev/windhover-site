import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './fonts-local.css'
import './index.css'
import ChurchHistory2App from './ChurchHistory2App.jsx'
import { lifelinesClerkKey } from './utils/lifelinesAuth.js'

// ChurchHistory2App renders its Clerk-aware branch — and so calls useAuth —
// exactly when lifelinesClerkKey() returns a key, which only works inside a
// provider; both files ask the same function. Readers get no key: Clerk is
// for the owner (?admin, or already signed in), not loaded for everyone.
const PUBLISHABLE_KEY = lifelinesClerkKey()
const root = document.getElementById('root')

if (!PUBLISHABLE_KEY) {
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
