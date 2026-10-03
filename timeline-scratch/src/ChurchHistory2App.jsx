import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import { Timeline } from './components/Timeline/Timeline.jsx';
import { TimelineSearch } from './components/Timeline/components/TimelineSearch.jsx';
import { computeFocusSet } from './components/Timeline/utils/focusSet.js';
import { fetchChurchHistory2Data, fetchTourScenes, updateLinkedMediaCrop } from './data/churchHistory2Adapter.js';
import { churchHistory2Config } from './data/churchHistory2Data.js';
import { AddNoteModal } from './components/Notes/AddNoteModal.jsx';
import { ViewMyNotesModal } from './components/Notes/ViewMyNotesModal.jsx';
import { checkUserRole, ensureUserExists } from './services/adminService.js';
import { AdminSuggestionsPage } from './components/Suggestions/AdminSuggestionsPage.jsx';
import { SuggestNewModal } from './components/Suggestions/SuggestNewModal.jsx';
import { IssueCreatorButton } from './components/IssueCreator/IssueCreatorButton.jsx';
import { Icon } from './components/Timeline/components/Icon.jsx';
import { FeedbackButton } from './components/Feedback/FeedbackButton.jsx';
import { useTour } from './components/Tour/useTour.js';
import { WelcomeDialog } from './components/Tour/WelcomeDialog.jsx';
import { TourPanel } from './components/Tour/TourPanel.jsx';
import './App.css';
import './ChurchHistory2App.css';

const BIRD_LOGO = new URL('../../../resources/logos/Windhover_BLK.png', import.meta.url).href;

// Lifelines remembers its own tour: sharing 1.0's key meant a reader who had
// seen that tour never got the welcome here.
const LIFELINES_TOUR_KEY = 'lifelines-tour-completed';

const hasClerk = !!(window.CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

// Readers don't need accounts, so Lifelines shows no sign-in. The owner opens
// it with ?admin to get the Sign In button; once signed in, the admin tools
// show without the flag, since the session already says who this is.
const ADMIN_MODE = new URLSearchParams(window.location.search).has('admin');

const EMPTY_LAYER = { people: [], points: [], periods: [] };

/** Split a merged dataset back into its two layers by the adapter's tag. */
function splitByLayer(merged) {
  if (!merged) return { front: EMPTY_LAYER, back: EMPTY_LAYER };
  const front = { people: [], points: [], periods: [] };
  const back = { people: [], points: [], periods: [] };
  for (const key of ['people', 'points', 'periods']) {
    for (const item of merged[key] || []) {
      (item.layer === 'back' ? back : front)[key].push(item);
    }
  }
  return { front, back };
}

/**
 * The depth state of the background layer, and which person it is focused on.
 *
 * Focus has two strengths and they are not the same interaction: hovering a
 * figure *previews* their background, clicking one *locks* it so it stays
 * legible while the detail panel is open. Holding Alt overrides both and
 * brings the whole layer forward.
 */
function useDepthFocus(index) {
  const [depthMode, setDepthMode] = useState('watercolour');
  const [focusedPersonId, setFocusedPersonId] = useState(null);
  const [hoverPersonId, setHoverPersonId] = useState(null);
  const [altHeld, setAltHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Alt') setAltHeld(true); };
    const onKeyUp = (e) => { if (e.key === 'Alt') setAltHeld(false); };
    // A window that loses focus never delivers the keyup, which would leave
    // the layer stuck forward.
    const onBlur = () => setAltHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const activeId = focusedPersonId ?? hoverPersonId;
  const isPreview = !focusedPersonId && Boolean(hoverPersonId);

  const focusIds = useMemo(
    () => computeFocusSet(activeId, index),
    [activeId, index]
  );

  const handlePersonSelect = useCallback((personId) => {
    setFocusedPersonId(personId);
  }, []);

  return {
    depthMode,
    setDepthMode,
    effectiveDepthMode: altHeld ? 'forward' : depthMode,
    focusIds,
    isPreview,
    onPersonHover: setHoverPersonId,
    onPersonSelect: handlePersonSelect,
  };
}

/**
 * Auth header rendered only when Clerk is configured.
 * Isolated so the useAuth hook is always called inside ClerkProvider.
 */
function ClerkAuthHeader({
  onAddNote,
  onViewNotes,
  isAdmin,
  isContributor,
  onReviewSuggestions,
  onSuggestNew,
  getToken,
  clerkUserId,
  getPageContext,
}) {
  const { isSignedIn } = useAuth();

  return (
    <div className="auth-actions">
      {isSignedIn && (
        <>
          {isAdmin && (
            <>
              <button type="button" className="btn" onClick={onAddNote}>
                + Add Note
              </button>
              <button type="button" className="btn" onClick={onViewNotes}>
                View My Notes
              </button>
            </>
          )}
          {isContributor && (
            <button type="button" className="btn btn-action" onClick={onSuggestNew}>
              + Suggest New Entry
            </button>
          )}
          <IssueCreatorButton
            isContributor={isContributor}
            isAdmin={isAdmin}
            getToken={getToken}
            clerkUserId={clerkUserId}
            appId="ch-timeline-2"
            getPageContext={getPageContext}
          />
          {isAdmin && (
            <button type="button" className="btn btn-warning" onClick={onReviewSuggestions}>
              Review Suggestions
            </button>
          )}
        </>
      )}
      {ADMIN_MODE && (
        <SignedOut>
          <SignInButton mode="modal">
            <button className="btn" title="Sign in to save notes, add entries, or make suggestions">Sign In</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="btn" title="Sign in to save notes, add entries, or make suggestions">Sign Up</button>
          </SignUpButton>
        </SignedOut>
      )}
      <SignedIn>
        <UserButton />
      </SignedIn>
    </div>
  );
}

/**
 * The timeline itself, plus the tour panel when a tour is running.
 *
 * Shared by the authenticated and unauthenticated shells so the two cannot
 * drift — the only difference between them is which extra props they can
 * supply.
 */
function Timeline2({
  timelineRef,
  frontData,
  backData,
  index,
  tour,
  timelineProps = {},
  isAdmin = false,
  onMediaCropUpdate,
}) {
  // useTour reasons about one flat dataset — scene ids span both layers — so
  // it is given the merged set (see useMergedLayers in the shells) and its
  // output is split back apart here. The hook needs no knowledge of layers.
  const tourLayers = useMemo(
    () => (tour.tourActive ? splitByLayer(tour.tourData) : null),
    [tour.tourActive, tour.tourData]
  );

  const depth = useDepthFocus(index);

  // The one scene that asked for "everything at once" now means "bring the
  // background forward" — there are no period brackets left for it to reveal.
  const sceneWantsBackground = tour.tourActive && tour.currentScene?.includePeriodsAndPoints;

  return (
    <>
      <Timeline
        ref={timelineRef}
        data={tourLayers ? tourLayers.front : frontData}
        backData={tourLayers ? tourLayers.back : backData}
        config={churchHistory2Config}
        showBackgroundImage={false}
        focusIds={depth.focusIds}
        depthMode={sceneWantsBackground ? 'forward' : depth.effectiveDepthMode}
        isFocusPreview={depth.isPreview}
        onPersonHover={depth.onPersonHover}
        onPersonSelect={depth.onPersonSelect}
        onDepthModeChange={depth.setDepthMode}
        // The tour panel already owns the right-hand rail, and its scenes open
        // a centred dialog on purpose. Dock the detail only outside the tour.
        detailVariant={tour.tourActive ? 'modal' : 'panel'}
        animatingIds={tour.tourActive ? tour.newlyAddedIds : undefined}
        animatingPointIds={tour.tourActive ? tour.newlyAddedPointIds : undefined}
        hideLegend={tour.tourActive && !tour.currentScene?.isBuildOut}
        isTourMode={tour.tourActive}
        {...timelineProps}
      />
      {tour.tourActive && (
        <TourPanel
          scene={tour.currentScene}
          sceneIndex={tour.sceneIndex}
          totalScenes={tour.totalScenes}
          onNext={tour.nextScene}
          onPrev={tour.prevScene}
          onSkip={tour.skipTour}
          onComplete={tour.completeTour}
          media={tour.sceneMedia}
          isAdmin={isAdmin}
          onMediaCropUpdate={onMediaCropUpdate}
        />
      )}
    </>
  );
}

/**
 * One flat dataset over both layers, for the pieces that reason about the
 * whole timeline rather than about depth: search, the tour, the notes picker.
 */
function useMergedLayers(frontData, backData) {
  return useMemo(() => ({
    people: [...(frontData?.people || []), ...(backData?.people || [])],
    points: [...(frontData?.points || []), ...(backData?.points || [])],
    periods: [...(frontData?.periods || []), ...(backData?.periods || [])],
  }), [frontData, backData]);
}

/**
 * Inner app that calls useAuth — only rendered when ClerkProvider wraps us.
 */
function AuthenticatedApp({ frontData, backData, index, loading, error, allPeople, onReloadData, tourScenes }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const { user: clerkUser } = useUser();
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [viewNotesOpen, setViewNotesOpen] = useState(false);
  const [suggestNewOpen, setSuggestNewOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isContributor, setIsContributor] = useState(false);
  const [view, setView] = useState('timeline'); // 'timeline' | 'suggestions'
  const timelineRef = useRef(null);

  const searchData = useMergedLayers(frontData, backData);
  const tour = useTour({ fullData: searchData, timelineRef, scenes: tourScenes, storageKey: LIFELINES_TOUR_KEY });

  // Auto-register user on sign-in, then check their role.
  const clerkUserLoaded = clerkUser && clerkUser.id;

  useEffect(() => {
    if (!isSignedIn || !userId || !clerkUserLoaded) {
      if (!isSignedIn) {
        setIsAdmin(false);
        setIsContributor(false);
      }
      return;
    }

    let cancelled = false;
    const getTokenForSupabase = () => getToken({ template: 'supabase' });

    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    const displayName = clerkUser?.fullName || clerkUser?.firstName || null;

    ensureUserExists(getTokenForSupabase, userId, email, displayName)
      .then(() => checkUserRole(getTokenForSupabase, userId))
      .then(result => {
        if (!cancelled) {
          setIsAdmin(result.isAdmin);
          setIsContributor(result.isContributor);
        }
      });

    return () => { cancelled = true; };
  }, [isSignedIn, userId, getToken, clerkUserLoaded]);

  const handleAddNoteClose = useCallback(() => {
    setAddNoteOpen(false);
  }, []);

  const authContext = isSignedIn
    ? { getToken, clerkUserId: userId, isSignedIn: true }
    : null;

  const adminContext = isAdmin
    ? { isAdmin: true, getToken: () => getToken({ template: 'supabase' }) }
    : null;

  const contributorContext = isContributor
    ? { isContributor: true, getToken: () => getToken({ template: 'supabase' }), clerkUserId: userId }
    : null;

  const getPageContext = useCallback(() => ({
    app: 'ch-timeline-2',
    url: window.location.pathname,
    view,
  }), [view]);

  const getTokenForSupabase = useCallback(() => getToken({ template: 'supabase' }), [getToken]);

  const handleEntityUpdated = useCallback(() => {
    onReloadData?.();
  }, [onReloadData]);

  const handleMediaCropUpdate = useCallback((mediaId, posX, posY) => {
    if (!isAdmin) return;
    updateLinkedMediaCrop(mediaId, posX, posY, () => getToken({ template: 'supabase' }))
      .catch(err => console.warn('Failed to save crop position:', err));
  }, [isAdmin, getToken]);

  const handleSearchSelect = useCallback((type, item) => {
    timelineRef.current?.selectItem(type, item);
  }, []);

  const handleSearchHighlight = useCallback((matches, currentIdx, query) => {
    timelineRef.current?.highlight(matches, currentIdx, query);
  }, []);

  const handleSearchClearHighlight = useCallback(() => {
    timelineRef.current?.clearHighlight();
  }, []);

  const timelineProps = useMemo(() => ({
    authContext,
    allPeople,
    adminContext,
    contributorContext,
    onEntityUpdated: handleEntityUpdated,
    onDataChanged: handleEntityUpdated,
  }), [authContext, allPeople, adminContext, contributorContext, handleEntityUpdated]);

  if (view === 'suggestions' && isAdmin) {
    return (
      <>
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="site-title"><strong>Lifelines</strong> <span>A church history timeline by lifespans</span></h1>
            </div>
            <div className="header-right">
              <ClerkAuthHeader
                onAddNote={() => setAddNoteOpen(true)}
                onViewNotes={() => setViewNotesOpen(true)}
                isAdmin={isAdmin}
                isContributor={isContributor}
                onReviewSuggestions={() => setView('suggestions')}
                onSuggestNew={() => setSuggestNewOpen(true)}
                getToken={getTokenForSupabase}
                clerkUserId={userId}
                getPageContext={getPageContext}
              />
            </div>
          </div>
        </header>
        <div className="tab-content" style={{ overflow: 'auto' }}>
          <AdminSuggestionsPage
            getToken={() => getToken({ template: 'supabase' })}
            clerkUserId={userId}
            onBack={() => setView('timeline')}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            {frontData && (
              <TimelineSearch
                ranked
                data={searchData}
                onSelectItem={handleSearchSelect}
                onHighlight={handleSearchHighlight}
                onClearHighlight={handleSearchClearHighlight}
                homeLink={
                  // Not a link: Lifelines is the site's front page, so there
                  // is nowhere "home" to go back to.
                  <span className="header-bird-link">
                    <img src={BIRD_LOGO} alt="Windhover" className="header-bird-logo" />
                  </span>
                }
              />
            )}
          </div>
          <div className="header-right">
            <button type="button" className="btn" onClick={tour.startTour} title="Take the guided tour">
              <Icon name="book" size={14} />
              {' '}Tour
            </button>
            <FeedbackButton />
            <ClerkAuthHeader
              onAddNote={() => setAddNoteOpen(true)}
              onViewNotes={() => setViewNotesOpen(true)}
              isAdmin={isAdmin}
              isContributor={isContributor}
              onReviewSuggestions={() => setView('suggestions')}
              onSuggestNew={() => setSuggestNewOpen(true)}
              getToken={getTokenForSupabase}
              clerkUserId={userId}
              getPageContext={getPageContext}
            />
          </div>
        </div>
      </header>

      <div className="tab-content">
        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
            Loading the timeline…
          </div>
        )}
        {error && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-error)' }}>
            Error: {error}
          </div>
        )}
        {!loading && !error && frontData && (
          <div className="timeline-wrapper ch2-timeline-wrapper">
            <Timeline2
              timelineRef={timelineRef}
              frontData={frontData}
              backData={backData}
              index={index}
              tour={tour}
              timelineProps={timelineProps}
              isAdmin={isAdmin}
              onMediaCropUpdate={handleMediaCropUpdate}
            />
          </div>
        )}
      </div>

      {tour.showWelcome && !loading && !error && frontData && (
        <WelcomeDialog
          onStartTour={tour.startTour}
          onDismiss={tour.dismissWelcome}
          title="Welcome to Lifelines"
        />
      )}

      {isAdmin && addNoteOpen && (
        <AddNoteModal
          isOpen
          onClose={handleAddNoteClose}
          people={allPeople}
          getToken={getToken}
          clerkUserId={userId}
        />
      )}

      {isAdmin && viewNotesOpen && (
        <ViewMyNotesModal
          isOpen
          onClose={() => setViewNotesOpen(false)}
          people={allPeople}
          getToken={getToken}
          clerkUserId={userId}
        />
      )}

      {suggestNewOpen && (
        <SuggestNewModal
          isOpen
          onClose={() => setSuggestNewOpen(false)}
          getToken={() => getToken({ template: 'supabase' })}
          clerkUserId={userId}
        />
      )}
    </>
  );
}

/**
 * Unauthenticated fallback (no Clerk key configured).
 */
function UnauthenticatedApp({ frontData, backData, index, loading, error, tourScenes }) {
  const timelineRef = useRef(null);

  const searchData = useMergedLayers(frontData, backData);
  const tour = useTour({ fullData: searchData, timelineRef, scenes: tourScenes, storageKey: LIFELINES_TOUR_KEY });

  const handleSearchSelect = useCallback((type, item) => {
    timelineRef.current?.selectItem(type, item);
  }, []);

  const handleSearchHighlight = useCallback((matches, currentIdx, query) => {
    timelineRef.current?.highlight(matches, currentIdx, query);
  }, []);

  const handleSearchClearHighlight = useCallback(() => {
    timelineRef.current?.clearHighlight();
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            {frontData && (
              <TimelineSearch
                ranked
                data={searchData}
                onSelectItem={handleSearchSelect}
                onHighlight={handleSearchHighlight}
                onClearHighlight={handleSearchClearHighlight}
                homeLink={
                  // Not a link: Lifelines is the site's front page, so there
                  // is nowhere "home" to go back to.
                  <span className="header-bird-link">
                    <img src={BIRD_LOGO} alt="Windhover" className="header-bird-logo" />
                  </span>
                }
              />
            )}
          </div>
          <div className="header-right">
            <button type="button" className="btn" onClick={tour.startTour} title="Take the guided tour">
              <Icon name="book" size={14} />
              {' '}Tour
            </button>
            <FeedbackButton />
            {ADMIN_MODE && (
              <div className="auth-actions">
                <button
                  className="btn"
                  disabled
                  title="Auth not configured — set CLERK_PUBLISHABLE_KEY in Cloudflare Pages env vars"
                >
                  Sign-in unavailable
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="tab-content">
        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
            Loading the timeline…
          </div>
        )}
        {error && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-error)' }}>
            Error: {error}
          </div>
        )}
        {!loading && !error && frontData && (
          <div className="timeline-wrapper ch2-timeline-wrapper">
            <Timeline2
              timelineRef={timelineRef}
              frontData={frontData}
              backData={backData}
              index={index}
              tour={tour}
            />
          </div>
        )}
      </div>

      {tour.showWelcome && !loading && !error && frontData && (
        <WelcomeDialog
          onStartTour={tour.startTour}
          onDismiss={tour.dismissWelcome}
          title="Welcome to Lifelines"
        />
      )}
    </>
  );
}

function ChurchHistory2App() {
  const [frontData, setFrontData] = useState(null);
  const [backData, setBackData] = useState(null);
  const [index, setIndex] = useState(null);
  const [allPeople, setAllPeople] = useState([]);
  const [tourScenes, setTourScenes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        if (!frontData) setLoading(true);
        setError(null);
        // Fetch main data first (initializes the Supabase client singleton),
        // then tour scenes reuse the same client.
        const result = await fetchChurchHistory2Data();
        const scenes = await fetchTourScenes().catch(() => null);
        if (cancelled) return;
        setFrontData(result.data);
        setBackData(result.backData);
        setIndex(result.index);
        // The people picker covers both layers — a note can be about an
        // emperor as readily as about a bishop.
        setAllPeople([
          ...(result.data.people || []),
          ...(result.backData.people || []),
        ].map(p => ({ id: p.id, name: p.name })));
        setTourScenes(scenes);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReloadData = useCallback(() => {
    setReloadKey(k => k + 1);
  }, []);

  return (
    <div className="app ch2-app">
      {hasClerk ? (
        <AuthenticatedApp
          frontData={frontData}
          backData={backData}
          index={index}
          loading={loading}
          error={error}
          allPeople={allPeople}
          onReloadData={handleReloadData}
          tourScenes={tourScenes}
        />
      ) : (
        <UnauthenticatedApp
          frontData={frontData}
          backData={backData}
          index={index}
          loading={loading}
          error={error}
          tourScenes={tourScenes}
        />
      )}
    </div>
  );
}

export default ChurchHistory2App;
