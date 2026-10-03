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
import { fetchBiblicalPlacesData } from './data/biblicalPlacesSupabaseAdapter.js';
import { getTerritoriesForAge, getTerritoryLabelsForAge } from './data/biblicalTerritories.js';
import { BiblicalPlacesMap } from './components/BiblicalPlaces/BiblicalPlacesMap.jsx';
import { NarrativeAgeFilter } from './components/BiblicalPlaces/NarrativeAgeFilter.jsx';
import { BiblicalPlacesSearch } from './components/BiblicalPlaces/BiblicalPlacesSearch.jsx';
import { PlaceModal } from './components/BiblicalPlaces/PlaceModal.jsx';
import { PersonModal } from './components/BiblicalPlaces/PersonModal.jsx';
import { EventModal } from './components/BiblicalPlaces/EventModal.jsx';
import { checkUserRole, ensureUserExists } from './services/adminService.js';
import { IssueCreatorButton } from './components/IssueCreator/IssueCreatorButton.jsx';
import './BiblicalPlacesApp.css';

function formatYear(year) {
  if (year == null) return '';
  if (year < 0) return `${Math.abs(year)} BC`;
  if (year === 0) return '1 BC';
  return `${year} AD`;
}

/**
 * Compute evenly spaced tick values between start and end, snapped to nice
 * round numbers.  Drops any that would overlap the start/end labels or each
 * other (using a minimum-distance threshold expressed as a percentage of the
 * total span).
 */
function computeTicks(start, end) {
  const span = end - start;
  if (span <= 0) return [];

  // Pick a nice step
  const rawStep = span / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep))));
  const niceMultiples = [1, 2, 5, 10];
  let step = magnitude;
  for (const m of niceMultiples) {
    if (magnitude * m >= rawStep) { step = magnitude * m; break; }
  }

  // Generate ticks
  const firstTick = Math.ceil(start / step) * step;
  let ticks = [];
  for (let t = firstTick; t <= end; t += step) {
    if (t > start && t < end) ticks.push(t);
  }

  // Thin to at most 3
  while (ticks.length > 3) {
    ticks = ticks.filter((_, i) => i % 2 === 0);
  }

  // Drop ticks that are too close to start, end, or each other.
  // "Too close" = within 18% of the span (roughly the width of a label).
  const minGap = span * 0.18;
  const result = [];
  for (const t of ticks) {
    if (t - start < minGap) continue;          // too close to start label
    if (end - t < minGap) continue;            // too close to end label
    const prev = result[result.length - 1];
    if (prev != null && t - prev < minGap) continue; // too close to previous tick
    result.push(t);
  }
  return result;
}

const hasClerk = !!(window.CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

function BiblicalPlacesApp() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalStack, setModalStack] = useState([]); // [{ type, id }]
  const [activeAgeFilter, setActiveAgeFilter] = useState(null);
  const [mapYear, setMapYear] = useState(null);
  const [activeTheme, setActiveTheme] = useState(null);   // theme_id | '__women__' | null
  const [activeJourney, setActiveJourney] = useState(null); // journey_id | null
  const [filterTab, setFilterTab] = useState('periods');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isContributor, setIsContributor] = useState(false);
  const [selectedStopIndex, setSelectedStopIndex] = useState(0);
  const mapRef = useRef(null);

  // Auth state (only used when Clerk is configured)
  const auth = hasClerk ? useAuth() : {};  // eslint-disable-line react-hooks/rules-of-hooks
  const userHook = hasClerk ? useUser() : {};  // eslint-disable-line react-hooks/rules-of-hooks
  const { getToken, isSignedIn, userId } = auth;
  const clerkUser = userHook.user;
  const clerkUserLoaded = clerkUser && clerkUser.id;

  // Auto-register user on sign-in, then check their role
  useEffect(() => {
    if (!hasClerk || !isSignedIn || !userId || !clerkUserLoaded) {
      if (!isSignedIn) { setIsAdmin(false); setIsContributor(false); }
      return;
    }

    let cancelled = false;
    const getTokenForSupabase = () => getToken({ template: 'supabase' });
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    const displayName = clerkUser?.fullName || clerkUser?.firstName || null;

    ensureUserExists(getTokenForSupabase, userId, email, displayName)
      .then(() => checkUserRole(getTokenForSupabase, userId))
      .then(result => {
        if (!cancelled) { setIsAdmin(result.isAdmin); setIsContributor(result.isContributor); }
      });

    return () => { cancelled = true; };
  }, [isSignedIn, userId, getToken, clerkUserLoaded]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchBiblicalPlacesData();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Modal stack management ──────────────────────────────────────────────

  const pushModal = useCallback((type, id) => {
    setModalStack(prev => [...prev, { type, id }]);
  }, []);

  const popModal = useCallback(() => {
    setModalStack(prev => prev.slice(0, -1));
  }, []);

  const closeAllModals = useCallback(() => {
    setModalStack([]);
  }, []);

  const currentModal = modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;

  // ── Entity selection handler (used by modals and search) ────────────────

  const handleSelectEntity = useCallback((type, id) => {
    pushModal(type, id);
    // If selecting a place, fly the map to it
    if (type === 'place' && data) {
      const place = data.placeMap.get(id);
      if (place && mapRef.current?.flyTo) {
        mapRef.current.flyTo(place.lng, place.lat);
      }
    }
  }, [pushModal, data]);

  // ── Reset view ─────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setActiveAgeFilter(null);
    setActiveTheme(null);
    setActiveJourney(null);
    setMapYear(null);
    setFilterTab('periods');
    closeAllModals();
    mapRef.current?.reset?.();
  }, [closeAllModals]);

  // ── Age filter ──────────────────────────────────────────────────────────

  const handleAgeFilter = useCallback((ageId) => {
    const newFilter = activeAgeFilter === ageId ? null : ageId;
    setActiveAgeFilter(newFilter);
    // Clear other filters for mutual exclusivity
    setActiveTheme(null);
    setActiveJourney(null);

    // Set map year to midpoint of the age's date range and apply immediately
    if (newFilter && data) {
      const age = data.ageMap.get(newFilter);
      if (age?.approx_start_year != null && age?.approx_end_year != null) {
        const midpoint = Math.round((age.approx_start_year + age.approx_end_year) / 2);
        setMapYear(midpoint);
        mapRef.current?.setYear?.(midpoint);
      } else {
        setMapYear(null);
      }
    } else {
      setMapYear(null);
    }

    // Zoom to the geographic region for this age
    if (newFilter && data) {
      const age = data.ageMap.get(newFilter);
      if (age?.map_bounds) {
        // map_bounds is [sw_lng, sw_lat, ne_lng, ne_lat]
        const b = age.map_bounds;
        mapRef.current?.fitBounds?.([[b[0], b[1]], [b[2], b[3]]]);
      } else {
        // Fall back: fit to all visible places for this age (events + person-place links)
        const visiblePlaces = data.places.filter(p => {
          const events = data.placeEventsMap.get(p.place_id) || [];
          const people = data.placePeopleMap.get(p.place_id) || [];
          return events.some(e => e.narrative_age_id === newFilter)
              || people.some(pp => pp.age?.age_id === newFilter);
        });
        if (visiblePlaces.length > 1) {
          const lngs = visiblePlaces.map(p => p.lng);
          const lats = visiblePlaces.map(p => p.lat);
          mapRef.current?.fitBounds?.([
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ]);
        } else if (visiblePlaces.length === 1) {
          mapRef.current?.flyTo?.(visiblePlaces[0].lng, visiblePlaces[0].lat);
        }
      }
    } else if (!newFilter) {
      mapRef.current?.reset?.();
    }
  }, [activeAgeFilter, data]);

  // ── Age change from PlaceModal nav (always sets, never toggles) ────────

  const handleAgeChange = useCallback((ageId) => {
    if (!ageId || !data) return;
    setActiveAgeFilter(ageId);
    const age = data.ageMap.get(ageId);
    if (age?.approx_start_year != null && age?.approx_end_year != null) {
      const midpoint = Math.round((age.approx_start_year + age.approx_end_year) / 2);
      setMapYear(midpoint);
      mapRef.current?.setYear?.(midpoint);
    } else {
      setMapYear(null);
    }
    if (age?.map_bounds) {
      const b = age.map_bounds;
      mapRef.current?.fitBounds?.([[b[0], b[1]], [b[2], b[3]]]);
    }
  }, [data]);

  // ── Theme filter ────────────────────────────────────────────────────────

  const handleThemeSelect = useCallback((themeId) => {
    const newTheme = activeTheme === themeId ? null : themeId;
    setActiveTheme(newTheme);
    setSelectedStopIndex(0);
    // Clear other filters for mutual exclusivity
    setActiveAgeFilter(null);
    setActiveJourney(null);
    setMapYear(null);

    if (newTheme && data) {
      if (newTheme === '__women__') {
        // Fit to all women-linked places
        const wPlaces = data.places.filter(p => data.womenPlaceIds.has(p.place_id));
        if (wPlaces.length > 1) {
          const lngs = wPlaces.map(p => p.lng);
          const lats = wPlaces.map(p => p.lat);
          mapRef.current?.fitBounds?.([
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ]);
        }
      } else {
        // Fit to theme stop places
        const stops = data.themeStopsMap.get(newTheme) || [];
        const stopPlaces = stops.map(s => s.place).filter(Boolean);
        if (stopPlaces.length > 1) {
          const lngs = stopPlaces.map(p => p.lng);
          const lats = stopPlaces.map(p => p.lat);
          mapRef.current?.fitBounds?.([
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ]);
        } else if (stopPlaces.length === 1) {
          mapRef.current?.flyTo?.(stopPlaces[0].lng, stopPlaces[0].lat);
        }
        // Open the first stop's detail panel
        const firstStop = stops[0];
        if (firstStop?.place_id) {
          handleSelectEntity('place', firstStop.place_id);
        }
      }
    } else if (!newTheme) {
      mapRef.current?.reset?.();
    }
  }, [activeTheme, data, handleSelectEntity]);

  // ── Journey filter ─────────────────────────────────────────────────────

  const handleJourneySelect = useCallback((journeyId) => {
    const newJourney = activeJourney === journeyId ? null : journeyId;
    setActiveJourney(newJourney);
    setSelectedStopIndex(0);
    // Clear other filters for mutual exclusivity
    setActiveAgeFilter(null);
    setActiveTheme(null);
    setMapYear(null);

    if (newJourney && data) {
      const stops = data.journeyStopsMap.get(newJourney) || [];
      const stopPlaces = stops.map(s => s.place).filter(Boolean);
      if (stopPlaces.length > 1) {
        const lngs = stopPlaces.map(p => p.lng);
        const lats = stopPlaces.map(p => p.lat);
        mapRef.current?.fitBounds?.([
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ]);
      } else if (stopPlaces.length === 1) {
        mapRef.current?.flyTo?.(stopPlaces[0].lng, stopPlaces[0].lat);
      }
      // Open the first stop's detail panel
      const firstStop = stops[0];
      if (firstStop?.place_id) {
        handleSelectEntity('place', firstStop.place_id);
      }
    } else if (!newJourney) {
      mapRef.current?.reset?.();
    }
  }, [activeJourney, data, handleSelectEntity]);

  // ── Derived data for active theme/journey ──────────────────────────────

  const themeStopPlaceIds = useMemo(() => {
    if (!activeTheme || activeTheme === '__women__' || !data) return null;
    const stops = data.themeStopsMap.get(activeTheme) || [];
    return new Set(stops.map(s => s.place_id).filter(Boolean));
  }, [activeTheme, data]);

  const currentThemeStops = useMemo(() => {
    if (!activeTheme || activeTheme === '__women__' || !data) return [];
    return data.themeStopsMap.get(activeTheme) || [];
  }, [activeTheme, data]);

  const activeThemeObj = useMemo(() => {
    if (!activeTheme || activeTheme === '__women__' || !data) return null;
    return data.themeMap.get(activeTheme) || null;
  }, [activeTheme, data]);

  const currentJourneyStops = useMemo(() => {
    if (!activeJourney || !data) return [];
    return data.journeyStopsMap.get(activeJourney) || [];
  }, [activeJourney, data]);

  const activeJourneyObj = useMemo(() => {
    if (!activeJourney || !data) return null;
    return data.journeyMap.get(activeJourney) || null;
  }, [activeJourney, data]);

  // ── Territory overlays for active narrative age ────────────────────────

  const territories = useMemo(() => {
    if (!activeAgeFilter) return null;
    return getTerritoriesForAge(activeAgeFilter);
  }, [activeAgeFilter]);

  const territoryLabels = useMemo(() => {
    if (!activeAgeFilter) return null;
    return getTerritoryLabelsForAge(activeAgeFilter);
  }, [activeAgeFilter]);

  // ── Search → fly to place ──────────────────────────────────────────────

  const handleSearchSelect = useCallback((type, id) => {
    handleSelectEntity(type, id);
  }, [handleSelectEntity]);

  const showReset = !!(activeAgeFilter || activeTheme || activeJourney || modalStack.length > 0);

  // Unified overlay stops: whichever of theme/journey is active
  const activeOverlayStops = activeJourney
    ? currentJourneyStops
    : (activeTheme && activeTheme !== '__women__') ? currentThemeStops : null;

  const activeOverlayColor = activeJourney
    ? (activeJourneyObj?.color || '#8b7355')
    : (activeThemeObj?.color || '#8b7355');

  // Helper: select a stop by index and fly the map to it (works for both themes and journeys)
  const handleSelectStop = useCallback((index) => {
    if (!activeOverlayStops || index < 0 || index >= activeOverlayStops.length) return;
    setSelectedStopIndex(index);
    const stop = activeOverlayStops[index];
    if (stop?.place) {
      mapRef.current?.flyTo?.(stop.place.lng, stop.place.lat);
      handleSelectEntity('place', stop.place_id);
    }
  }, [activeOverlayStops, handleSelectEntity]);

  // Rich context capture for the issue creator
  const getPageContext = useCallback(() => {
    const ctx = {
      app: 'bible-atlas',
      url: window.location.pathname,
      activeFilters: {
        ageFilter: activeAgeFilter,
        journey: activeJourney,
        theme: activeTheme,
      },
      selectedEntity: currentModal
        ? { type: currentModal.type, id: currentModal.id }
        : null,
      modalStack: modalStack.length > 0 ? modalStack : null,
    };
    return ctx;
  }, [activeAgeFilter, activeJourney, activeTheme, currentModal, modalStack]);

  return (
    <div className="bp-app">
      {/* Header overlay */}
      <header className="bp-header">
        {data && (
          <div className="bp-header-search">
            <BiblicalPlacesSearch
              data={data}
              onSelect={handleSearchSelect}
              homeHref="/home.html"
            />
          </div>
        )}
        {hasClerk && (
          <div className="bp-header-auth">
            <a className="bp-auth-btn" href="./contributor-portal.html" style={{ textDecoration: 'none' }}>Contributor Portal</a>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bp-auth-btn" title="Sign in to report issues">Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="bp-auth-btn" title="Create an account">Sign Up</button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <IssueCreatorButton
                isContributor={isContributor}
                isAdmin={isAdmin}
                getToken={() => getToken({ template: 'supabase' })}
                clerkUserId={userId}
                appId="bible-atlas"
                getPageContext={getPageContext}
              />
              <UserButton />
            </SignedIn>
          </div>
        )}
      </header>

      {/* Main content */}
      {loading && (
        <div className="bp-loading">Loading data from Supabase...</div>
      )}
      {error && (
        <div className="bp-error">Error: {error}</div>
      )}
      {!loading && !error && data && (
        <>
          <BiblicalPlacesMap
            ref={mapRef}
            places={data.places}
            placeEventsMap={data.placeEventsMap}
            placePeopleMap={data.placePeopleMap}
            ageMap={data.ageMap}
            activeAgeFilter={activeAgeFilter}
            mapYear={mapYear}
            onSelectPlace={(placeId) => handleSelectEntity('place', placeId)}
            activeJourney={activeJourney}
            journeyStops={currentJourneyStops}
            journeyColor={activeJourneyObj?.color}
            selectedStopIndex={selectedStopIndex}
            activeTheme={activeTheme}
            themeStops={currentThemeStops}
            themeStopPlaceIds={themeStopPlaceIds}
            themeColor={activeThemeObj?.color}
            womenPlaceIds={data.womenPlaceIds}
            territories={territories}
            territoryLabels={territoryLabels}
          />
          <NarrativeAgeFilter
            ages={data.ages}
            activeAgeFilter={activeAgeFilter}
            onFilter={handleAgeFilter}
            themes={data.themes}
            activeTheme={activeTheme}
            onThemeSelect={handleThemeSelect}
            journeys={data.journeys}
            activeJourney={activeJourney}
            onJourneySelect={handleJourneySelect}
            activeTab={filterTab}
            onTabChange={setFilterTab}
            showReset={showReset}
            onReset={handleReset}
            siteTitle="Bible Atlas: who's where when?"
          />

          {/* Date range + year slider for active narrative age */}
          {activeAgeFilter && (() => {
            const age = data.ageMap.get(activeAgeFilter);
            if (!age) return null;
            const startY = age.approx_start_year;
            const endY = age.approx_end_year;
            if (startY == null || endY == null) return null;
            const ticks = computeTicks(startY, endY);
            return (
              <div className="bp-date-range">
                <span className="bp-date-range-label">{age.name}</span>
                <span className="bp-date-range-years">
                  {formatYear(mapYear)}
                </span>
                <div className="bp-year-slider-wrap">
                  <input
                    type="range"
                    className="bp-year-slider"
                    min={startY}
                    max={endY}
                    value={mapYear ?? Math.round((startY + endY) / 2)}
                    onChange={(e) => setMapYear(Number(e.target.value))}
                  />
                  <div className="bp-year-slider-labels">
                    <span>{formatYear(startY)}</span>
                    {ticks.map(t => (
                      <span
                        key={t}
                        style={{ left: `${((t - startY) / (endY - startY)) * 100}%` }}
                        className="bp-year-slider-tick"
                      >
                        {formatYear(t)}
                      </span>
                    ))}
                    <span>{formatYear(endY)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Journey info panel */}
          {activeJourney && activeJourneyObj && (
            <div className="bp-info-panel bp-info-panel--journey">
              <div className="bp-info-panel-header">
                <span
                  className="bp-info-panel-dot"
                  style={{ background: activeJourneyObj.color || '#8b7355' }}
                />
                <h3 className="bp-info-panel-title">{activeJourneyObj.name}</h3>
              </div>
              {activeJourneyObj.person && (
                <button
                  className="bp-info-panel-person"
                  onClick={() => handleSelectEntity('person', activeJourneyObj.person_id)}
                >
                  {activeJourneyObj.person.name}
                </button>
              )}
              {activeJourneyObj.description && (
                <p className="bp-info-panel-desc">{activeJourneyObj.description}</p>
              )}
              <div className="bp-journey-stops-list">
                {currentJourneyStops.map((stop, i) => {
                  const isSelected = i === selectedStopIndex;
                  return (
                    <button
                      key={stop.id || i}
                      className={`bp-journey-stop-item${isSelected ? ' bp-journey-stop-item--selected' : ''}`}
                      style={isSelected ? { '--journey-color': activeJourneyObj.color || '#8b7355' } : undefined}
                      onClick={() => handleSelectStop(i)}
                    >
                      <span
                        className="bp-journey-stop-num"
                        style={isSelected
                          ? { background: activeJourneyObj.color || '#8b7355', color: '#faf6eb' }
                          : { borderColor: activeJourneyObj.color || '#8b7355', color: activeJourneyObj.color || '#8b7355' }
                        }
                      >
                        {i + 1}
                      </span>
                      <span className="bp-journey-stop-text">
                        <span className="bp-journey-stop-label">
                          {stop.label || stop.place?.name || `Stop ${i + 1}`}
                        </span>
                        {stop.scripture_ref && (
                          <span className="bp-journey-stop-ref">{stop.scripture_ref}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Forward / backward navigation */}
              {currentJourneyStops.length > 1 && (
                <div className="bp-journey-nav">
                  <button
                    className="bp-journey-nav-btn"
                    disabled={selectedStopIndex <= 0}
                    onClick={() => handleSelectStop(selectedStopIndex - 1)}
                    title="Previous stop"
                  >
                    ‹ Prev
                  </button>
                  <span className="bp-journey-nav-pos">
                    {selectedStopIndex + 1} / {currentJourneyStops.length}
                  </span>
                  <button
                    className="bp-journey-nav-btn"
                    disabled={selectedStopIndex >= currentJourneyStops.length - 1}
                    onClick={() => handleSelectStop(selectedStopIndex + 1)}
                    title="Next stop"
                  >
                    Next ›
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Theme info panel */}
          {activeTheme && activeTheme !== '__women__' && activeThemeObj && (
            <div className="bp-info-panel bp-info-panel--journey">
              <div className="bp-info-panel-header">
                <span
                  className="bp-info-panel-dot"
                  style={{ background: activeThemeObj.color || '#8b7355' }}
                />
                <h3 className="bp-info-panel-title">{activeThemeObj.name}</h3>
              </div>
              {activeThemeObj.description && (
                <p className="bp-info-panel-desc">{activeThemeObj.description}</p>
              )}
              <div className="bp-journey-stops-list">
                {currentThemeStops.map((stop, i) => {
                  const isSelected = i === selectedStopIndex;
                  return (
                    <button
                      key={stop.id || i}
                      className={`bp-journey-stop-item${isSelected ? ' bp-journey-stop-item--selected' : ''}`}
                      style={isSelected ? { '--journey-color': activeThemeObj.color || '#8b7355' } : undefined}
                      onClick={() => handleSelectStop(i)}
                    >
                      <span
                        className="bp-journey-stop-num"
                        style={isSelected
                          ? { background: activeThemeObj.color || '#8b7355', color: '#faf6eb' }
                          : { borderColor: activeThemeObj.color || '#8b7355', color: activeThemeObj.color || '#8b7355' }
                        }
                      >
                        {i + 1}
                      </span>
                      <span className="bp-journey-stop-text">
                        <span className="bp-journey-stop-label">
                          {stop.title || stop.place?.name || `Stop ${i + 1}`}
                        </span>
                        {stop.scripture_ref && (
                          <span className="bp-journey-stop-ref">{stop.scripture_ref}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Forward / backward navigation */}
              {currentThemeStops.length > 1 && (
                <div className="bp-journey-nav">
                  <button
                    className="bp-journey-nav-btn"
                    disabled={selectedStopIndex <= 0}
                    onClick={() => handleSelectStop(selectedStopIndex - 1)}
                    title="Previous stop"
                  >
                    ‹ Prev
                  </button>
                  <span className="bp-journey-nav-pos">
                    {selectedStopIndex + 1} / {currentThemeStops.length}
                  </span>
                  <button
                    className="bp-journey-nav-btn"
                    disabled={selectedStopIndex >= currentThemeStops.length - 1}
                    onClick={() => handleSelectStop(selectedStopIndex + 1)}
                    title="Next stop"
                  >
                    Next ›
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Side panel */}
      {currentModal && data && (
        <div className="bp-side-panel">
          {currentModal.type === 'place' && (
            <PlaceModal
              place={data.placeMap.get(currentModal.id)}
              events={data.placeEventsMap.get(currentModal.id) || []}
              people={data.placePeopleMap.get(currentModal.id) || []}
              ageMap={data.ageMap}
              eventPeopleMap={data.eventPeopleMap}
              sourceMap={data.sourceMap}
              ages={data.ages}
              activeAgeFilter={activeAgeFilter}
              placeNamesMap={data.placeNamesMap}
              placeAgeSummariesMap={data.placeAgeSummariesMap}
              onAgeChange={handleAgeChange}
              onSelectEntity={handleSelectEntity}
              onClose={closeAllModals}
            />
          )}
          {currentModal.type === 'person' && (
            <PersonModal
              person={data.personMap.get(currentModal.id)}
              ages={data.personAgesMap.get(currentModal.id) || []}
              places={data.personPlacesMap.get(currentModal.id) || []}
              events={data.personEventsMap.get(currentModal.id) || []}
              ageMap={data.ageMap}
              placeMap={data.placeMap}
              sourceMap={data.sourceMap}
              onSelectEntity={handleSelectEntity}
              onClose={popModal}
              canGoBack={modalStack.length > 1}
              onBack={popModal}
            />
          )}
          {currentModal.type === 'event' && (
            <EventModal
              event={data.eventMap.get(currentModal.id)}
              people={data.eventPeopleMap.get(currentModal.id) || []}
              ageMap={data.ageMap}
              placeMap={data.placeMap}
              sourceMap={data.sourceMap}
              onSelectEntity={handleSelectEntity}
              onClose={popModal}
              canGoBack={modalStack.length > 1}
              onBack={popModal}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default BiblicalPlacesApp;
