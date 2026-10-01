import { useState, useEffect, useRef, useCallback } from 'react';
import { Timeline } from './components/Timeline/Timeline.jsx';
import { TimelineSearch } from './components/Timeline/components/TimelineSearch.jsx';
import { Icon } from './components/Timeline/components/Icon.jsx';
import { SiteNavPanel } from './components/SiteNavPanel.jsx';
import { fetchHeresiesData } from './data/heresiesSupabaseAdapter.js';
import { heresiesConfig } from './data/heresiesData.js';
import './App.css';

const EMPTY_DATA = { people: [], points: [], periods: [] };

function HeresiesApp() {
  const timelineRef = useRef(null);
  const [navOpen, setNavOpen] = useState(false);
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const { data } = await fetchHeresiesData();
        if (!cancelled) {
          setTimelineData(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Search handlers that delegate to Timeline ref
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
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <button
            className="btn btn-icon site-nav-toggle"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            title="Navigation"
          >
            <Icon name="menu" size={18} />
          </button>
          <div className="header-left">
            <TimelineSearch
              data={timelineData || EMPTY_DATA}
              onSelectItem={handleSearchSelect}
              onHighlight={handleSearchHighlight}
              onClearHighlight={handleSearchClearHighlight}
            />
          </div>
          <div className="header-right">
            <a className="btn btn-action" href="./church-history-2.html" title="Lifelines: This page's figures and movements, merged into the redesigned Church History timeline">
              Try Lifelines
            </a>
          </div>
        </div>
      </header>
      <SiteNavPanel
        open={navOpen}
        onClose={() => setNavOpen(false)}
        activeKey="heresies"
      />

      <div className="tab-content">
        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
            Loading the timeline…
          </div>
        )}
        {error && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
            Error: {error}
          </div>
        )}
        {!loading && !error && timelineData && (
          <div className="timeline-wrapper">
            <Timeline
              ref={timelineRef}
              data={timelineData}
              config={heresiesConfig}
              showBackgroundImage
              // Around twenty movements run concurrently through the fourth
              // century; the default 10px bracket rows put their labels on
              // top of each other, so give the periods lane more room.
              layoutSizes={{ periodBracketHeight: 24 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default HeresiesApp;
