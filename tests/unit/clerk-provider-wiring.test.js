/**
 * Every Vite entry point that mounts a Clerk-aware app must wrap it in a
 * <ClerkProvider>.
 *
 * This exists because CH Timeline 2.0 shipped without one. Its app is a fork
 * of ChurchHistorySupabaseApp, which calls useAuth whenever a publishable key
 * is present — but its entry point was copied from main-church-history.jsx,
 * which mounts a provider-free app. The page threw on first render for anyone
 * with a real key.
 *
 * Nothing caught it: every e2e fixture passes `clerkKey: ''`, so only the
 * unauthenticated branch of that fork ever rendered under test, and the branch
 * that actually ships was never exercised. A runtime test for this needs a
 * working Clerk stub; the invariant itself is static, so check it statically.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../timeline-scratch/src'
);

/** Importing any of these from @clerk/clerk-react requires provider context. */
const CONTEXT_DEPENDENT = [
  'useAuth', 'useUser', 'SignedIn', 'SignedOut',
  'UserButton', 'SignInButton', 'SignUpButton',
];

const entryPoints = fs.readdirSync(SRC).filter(f => /^main.*\.jsx$/.test(f));

/** The app modules an entry point mounts, as repo-relative paths. */
function mountedApps(entrySource) {
  return [...entrySource.matchAll(/import\s+\w+\s+from\s+'\.\/([\w/.-]+\.jsx)'/g)]
    .map(m => m[1])
    .filter(rel => fs.existsSync(path.join(SRC, rel)));
}

function needsProvider(appSource) {
  return appSource.includes('@clerk/clerk-react')
    && CONTEXT_DEPENDENT.some(name => appSource.includes(name));
}

describe('Clerk provider wiring', () => {
  it('finds the entry points', () => {
    // A rename that empties this list would make every case below vacuous.
    expect(entryPoints.length).toBeGreaterThan(5);
    expect(entryPoints).toContain('main-church-history-2.jsx');
  });

  it.each(entryPoints)('%s wraps its Clerk-aware app in a ClerkProvider', (entry) => {
    const entrySource = fs.readFileSync(path.join(SRC, entry), 'utf8');
    const clerkApps = mountedApps(entrySource)
      .filter(rel => needsProvider(fs.readFileSync(path.join(SRC, rel), 'utf8')));

    if (clerkApps.length === 0) return; // nothing to protect
    expect(
      entrySource.includes('ClerkProvider'),
      `${entry} mounts ${clerkApps.join(', ')}, which call into Clerk context, ` +
      `but never imports ClerkProvider`
    ).toBe(true);
  });

  it('gates on the same condition the app does', () => {
    // The entry point decides whether to render a provider; the app decides
    // whether to render the branch that needs one. If those two conditions
    // disagree the app throws, so both read the same two globals.
    const entry = fs.readFileSync(path.join(SRC, 'main-church-history-2.jsx'), 'utf8');
    const app = fs.readFileSync(path.join(SRC, 'ChurchHistory2App.jsx'), 'utf8');
    for (const source of [entry, app]) {
      expect(source).toContain('window.CLERK_PUBLISHABLE_KEY');
      expect(source).toContain('import.meta.env.VITE_CLERK_PUBLISHABLE_KEY');
    }
  });
});
