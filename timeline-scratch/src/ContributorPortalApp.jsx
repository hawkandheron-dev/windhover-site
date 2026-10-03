import { useCallback, useEffect, useState } from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import { GettingStartedPage } from './components/GettingStarted/GettingStartedPage.jsx';
import { SiteNavPanel } from './components/SiteNavPanel.jsx';
import { Icon } from './components/Timeline/components/Icon.jsx';
import { checkUserRole, ensureUserExists } from './services/adminService.js';
import './App.css';

const BIRD_LOGO = new URL('../../../resources/logos/Windhover_BLK.png', import.meta.url).href;

const hasClerk = !!(window.CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

function SiteNavToggle({ onOpen }) {
  return (
    <button
      className="btn btn-icon site-nav-toggle"
      onClick={onOpen}
      aria-label="Open navigation"
      title="Navigation"
      type="button"
    >
      <Icon name="menu" size={18} />
    </button>
  );
}

function AuthenticatedPortal() {
  const { getToken, isSignedIn, userId } = useAuth();
  const { user: clerkUser } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isContributor, setIsContributor] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  const clerkUserLoaded = clerkUser && clerkUser.id;

  useEffect(() => {
    if (!isSignedIn || !userId || !clerkUserLoaded) {
      if (!isSignedIn) {
        setIsAdmin(false);
        setIsContributor(false);
        setUserRole(null);
      }
      return;
    }

    let cancelled = false;
    const getTokenForSupabase = () => getToken({ template: 'supabase' });
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    const displayName = clerkUser?.username || clerkUser?.fullName || clerkUser?.firstName || null;

    ensureUserExists(getTokenForSupabase, userId, email, displayName)
      .then(() => checkUserRole(getTokenForSupabase, userId))
      .then(result => {
        if (!cancelled) {
          setIsAdmin(result.isAdmin);
          setIsContributor(result.isContributor);
          setUserRole(result.role);
        }
      });

    return () => { cancelled = true; };
  }, [isSignedIn, userId, getToken, clerkUserLoaded, clerkUser]);

  const getTokenForSupabase = useCallback(
    () => getToken({ template: 'supabase' }),
    [getToken],
  );

  const getPageContext = useCallback(() => ({
    app: 'contributor-portal',
    url: window.location.pathname,
  }), []);

  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  const displayName = clerkUser?.username || clerkUser?.fullName || clerkUser?.firstName || null;

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <SiteNavToggle onOpen={() => setNavOpen(true)} />
          <div className="header-left">
            <a href="/home.html" className="header-bird-link" title="Back to Windhover">
              <img src={BIRD_LOGO} alt="Windhover" className="header-bird-logo" />
            </a>
            <h1 className="site-title"><strong>Windhover</strong> <span>Contributor Portal</span></h1>
          </div>
          <div className="header-right">
            <div className="auth-actions">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="btn" title="Sign in to submit and discuss feedback">Sign In</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn" title="Create an account">Sign Up</button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </div>
        </div>
      </header>
      <SiteNavPanel open={navOpen} onClose={() => setNavOpen(false)} activeKey="contributor-portal" />
      <div className="tab-content" style={{ overflow: 'auto' }}>
        <GettingStartedPage
          getToken={getTokenForSupabase}
          clerkUserId={userId}
          displayName={displayName}
          email={email}
          role={userRole}
          isSignedIn={isSignedIn}
          isContributor={isContributor}
          isAdmin={isAdmin}
          appId="general"
          getPageContext={getPageContext}
          aggregateAcrossApps
        />
      </div>
    </>
  );
}

function UnauthenticatedPortal() {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <SiteNavToggle onOpen={() => setNavOpen(true)} />
          <div className="header-left">
            <a href="/home.html" className="header-bird-link" title="Back to Windhover">
              <img src={BIRD_LOGO} alt="Windhover" className="header-bird-logo" />
            </a>
            <h1 className="site-title"><strong>Windhover</strong> <span>Contributor Portal</span></h1>
          </div>
          <div className="header-right">
            <div className="auth-actions">
              <button
                className="btn"
                disabled
                title="Auth not configured — set CLERK_PUBLISHABLE_KEY in Cloudflare Pages env vars"
              >
                Sign-in unavailable
              </button>
            </div>
          </div>
        </div>
      </header>
      <SiteNavPanel open={navOpen} onClose={() => setNavOpen(false)} activeKey="contributor-portal" />
      <div className="tab-content" style={{ overflow: 'auto' }}>
        <GettingStartedPage
          getToken={null}
          clerkUserId={null}
          displayName={null}
          email={null}
          role={null}
          isSignedIn={false}
          isContributor={false}
          isAdmin={false}
          appId="general"
          aggregateAcrossApps
        />
      </div>
    </>
  );
}

export default function ContributorPortalApp() {
  return (
    <div className="app">
      {hasClerk ? <AuthenticatedPortal /> : <UnauthenticatedPortal />}
    </div>
  );
}
