/**
 * Whether this visit to Lifelines needs Clerk, and with which key.
 *
 * Readers never sign in, but mounting ClerkProvider downloads Clerk's
 * browser script from Clerk's servers and checks for a session there: a
 * large download and a third party contacted on every page view, for nobody.
 * So Clerk loads only when someone might use it:
 *   - the owner's `?admin` address, which shows the Sign In button; or
 *   - a browser that is already signed in, so the admin tools still appear
 *     without the flag. Clerk marks that with its `__client_uat` cookie
 *     (a sign-in timestamp; "0" when signed out).
 * If that cookie can't be seen, `?admin` still works.
 *
 * main-church-history-2.jsx (which mounts the provider) and
 * ChurchHistory2App.jsx (which picks the Clerk-aware branch) must agree, or
 * useAuth runs outside a provider and the app throws; both call this.
 */
export function lifelinesClerkKey({
  key = (typeof window !== 'undefined' && window.CLERK_PUBLISHABLE_KEY) || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  search = typeof window !== 'undefined' ? window.location.search : '',
  cookie = typeof document !== 'undefined' ? document.cookie : '',
} = {}) {
  if (!key) return null;
  return new URLSearchParams(search).has('admin') || hasClerkSession(cookie) ? key : null;
}

/** True when Clerk's cookie says this browser has signed in. */
export function hasClerkSession(cookie = '') {
  return /(?:^|;\s*)__client_uat(?:_[\w-]+)?=[1-9]\d*/.test(cookie);
}
