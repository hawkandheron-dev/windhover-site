/**
 * HistoricalErasApp
 *
 * Timeline of major historical eras + Pinterest-style vision board.
 * Click an era on the timeline to see a feed of curated images
 * from museum and archive APIs.  Scrolling to the bottom auto-loads
 * more images (infinite scroll).
 *
 * Favorites are persisted to Supabase (era_favorites table).
 * Favorited images load first and their keywords influence
 * subsequent image searches.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton
} from '@clerk/clerk-react';
import FavoritesTest from './components/FavoritesTest.tsx';
import { Timeline } from './components/Timeline/Timeline.jsx';
import { VisionBoard } from './components/VisionBoard/VisionBoard.jsx';
import {
  historicalErasTimelineData,
  historicalErasConfig,
  getEraKeywords,
  getEraById
} from './data/historicalErasData.js';
import { fetchImagesForKeywords } from './services/imageApiService.js';
import { useFavorites } from './hooks/useFavorites.ts';
import './App.css';
import './HistoricalErasApp.css';

function HistoricalErasApp() {
  const [selectedEra, setSelectedEra] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchIdRef = useRef(0); // guard against stale fetches
  const seenIdsRef = useRef(new Set()); // track already-loaded image ids for dedup

  const {
    favoriteUrls,
    favorites,
    priorityKeywords,
    errorMessage,
    loadFavorites,
    toggleFavorite,
    clearFavorites
  } = useFavorites();

  // Load initial images for a given era — favorites first, then API images
  const loadImages = useCallback(async (era) => {
    const keywords = getEraKeywords(era.id);
    if (keywords.length === 0) return;

    const id = ++fetchIdRef.current;
    seenIdsRef.current = new Set();
    setLoading(true);
    setImages([]);

    try {
      // Step 1: Fetch favorites from Supabase
      let favs = [];
      try {
        favs = await loadFavorites(era.id);
      } catch (e) {
        console.warn('Could not load favorites (Supabase may not be configured):', e);
      }

      if (id !== fetchIdRef.current) return;

      // Track favorite URLs and seed the seen-ids set
      const favUrlSet = new Set();
      for (const fav of favs) {
        favUrlSet.add(fav.thumbnailUrl);
        seenIdsRef.current.add(fav.id);
      }

      // Show favorites immediately while API images load
      if (favs.length > 0) {
        setImages(favs);
      }

      // Step 2: Fetch API images with priority keywords from favorites
      const results = await fetchImagesForKeywords(keywords, {
        eraName: era.name,
        priorityKeywords: priorityKeywords
      });

      if (id === fetchIdRef.current) {
        // Filter out images that duplicate favorites (by thumbnail URL)
        const newImages = results.filter(img => {
          if (seenIdsRef.current.has(img.id)) return false;
          if (favUrlSet.has(img.thumbnailUrl)) return false;
          return true;
        });
        newImages.forEach(img => seenIdsRef.current.add(img.id));
        setImages(prev => [...prev, ...newImages]);
      }
    } catch (e) {
      console.error('Failed to load images for era:', era.id, e);
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [loadFavorites, priorityKeywords]);

  // Load more images (infinite scroll) — appends to existing feed
  const loadMore = useCallback(async () => {
    if (!selectedEra || loading || loadingMore) return;

    const keywords = getEraKeywords(selectedEra.id);
    if (keywords.length === 0) return;

    const id = fetchIdRef.current; // don't increment — just check staleness
    setLoadingMore(true);

    try {
      const results = await fetchImagesForKeywords(keywords, {
        eraName: selectedEra.name,
        priorityKeywords: priorityKeywords
      });
      if (id === fetchIdRef.current) {
        // Filter out images we already have (by id or thumbnail URL)
        const newImages = results.filter(img => {
          if (seenIdsRef.current.has(img.id)) return false;
          if (favoriteUrls.has(img.thumbnailUrl)) return false;
          return true;
        });
        newImages.forEach(img => seenIdsRef.current.add(img.id));
        if (newImages.length > 0) {
          setImages(prev => [...prev, ...newImages]);
        }
      }
    } catch (e) {
      console.error('Failed to load more images:', e);
    } finally {
      if (id === fetchIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [selectedEra, loading, loadingMore, favoriteUrls, priorityKeywords]);

  // Toggle favorite on an image
  const handleToggleFavorite = useCallback(async (img) => {
    if (!selectedEra) return;
    await toggleFavorite(selectedEra.id, img);
  }, [selectedEra, toggleFavorite]);

  // Handle period click on the timeline
  const handleItemClick = useCallback((type, item) => {
    if (type === 'period') {
      const era = getEraById(item.id) || item;
      setSelectedEra(era);
      loadImages(era);
    }
  }, [loadImages]);

  // Close the vision board
  const handleClose = useCallback(() => {
    setSelectedEra(null);
    setImages([]);
    clearFavorites();
    seenIdsRef.current = new Set();
    fetchIdRef.current++; // cancel in-flight fetches
  }, [clearFavorites]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && selectedEra) {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedEra, handleClose]);

  return (
    <div className="app historical-eras-app">
      <header className="app-header">
        <div className="header-content">
          <h1>Historical Eras — Vision Board</h1>
          <nav className="tab-nav">
            <a href="/home.html" className="tab-button">Home</a>
            <a href="./index.html" className="tab-button">Timeline-Scratch</a>
          </nav>
        </div>
        <div className="auth-actions">
          <span className="auth-hint">Sign in to save favorites.</span>
          <SignedOut>
            <SignInButton mode="modal" />
            <SignUpButton mode="modal" />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>
      <FavoritesTest />

      {/* Favorites error toast */}
      {errorMessage && (
        <div className="favorites-error-toast" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Instruction banner (hidden once an era is selected) */}
      {!selectedEra && (
        <div className="eras-instruction">
          Click on any era in the timeline to explore a vision board of historical images
        </div>
      )}

      {/* Content area — timeline underneath, overlay on top when an era is selected */}
      <div className="eras-content-area">
        <div className="eras-timeline-panel">
          <Timeline
            data={historicalErasTimelineData}
            config={historicalErasConfig}
            onItemClick={handleItemClick}
            suppressModal
          />
        </div>

        {/* Vision board — covers the full content area when open */}
        {selectedEra && (
          <div className="eras-visionboard-overlay">
            <VisionBoard
              eraId={selectedEra.id}
              eraName={selectedEra.name}
              eraColor={selectedEra.color || '#888'}
              eraPreview={selectedEra.preview}
              eraDescription={selectedEra.description}
              images={images}
              loading={loading}
              loadingMore={loadingMore}
              onClose={handleClose}
              onLoadMore={loadMore}
              onToggleFavorite={handleToggleFavorite}
              favoriteUrls={favoriteUrls}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoricalErasApp;
