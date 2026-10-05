import { sizedImageUrl, TOUR_IMAGE_WIDTH } from './sizedImageUrl.js';
import { useEffect, useCallback, useState, useRef } from 'react';
import { Icon } from '../Timeline/components/Icon.jsx';
import './TourPanel.css';

function TourImage({ media, isAdmin, onCropUpdate }) {
  const [imgError, setImgError] = useState(false);
  // The image fades in once decoded, rather than painting in strips.
  const [loaded, setLoaded] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [posX, setPosX] = useState(media.cropPositionX ?? 50);
  const [posY, setPosY] = useState(media.cropPositionY ?? 50);
  const containerRef = useRef(null);
  const dragRef = useRef(null);

  // Reset position when media changes
  useEffect(() => {
    setPosX(media.cropPositionX ?? 50);
    setPosY(media.cropPositionY ?? 50);
    setImgError(false);
    setAdjusting(false);
  }, [media.mediaId]);

  const handleMouseDown = useCallback((e) => {
    if (!adjusting) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: posX, startPosY: posY };

    const handleMouseMove = (e) => {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Convert pixel movement to percentage (inverted: drag right = position moves left)
      const dx = ((e.clientX - dragRef.current.startX) / rect.width) * -100;
      const dy = ((e.clientY - dragRef.current.startY) / rect.height) * -100;
      setPosX(Math.max(0, Math.min(100, dragRef.current.startPosX + dx)));
      setPosY(Math.max(0, Math.min(100, dragRef.current.startPosY + dy)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [adjusting, posX, posY]);

  const handleSave = useCallback(() => {
    setAdjusting(false);
    onCropUpdate?.(media.mediaId, posX, posY);
  }, [media.mediaId, posX, posY, onCropUpdate]);

  const handleCancel = useCallback(() => {
    setPosX(media.cropPositionX ?? 50);
    setPosY(media.cropPositionY ?? 50);
    setAdjusting(false);
  }, [media.cropPositionX, media.cropPositionY]);

  if (imgError) return null;

  return (
    <div
      className={'tour-scene-image' + (adjusting ? ' tour-scene-image-adjusting' : '')}
      ref={containerRef}
      onMouseDown={handleMouseDown}
    >
      <img
        src={sizedImageUrl(media.mediaUrl, TOUR_IMAGE_WIDTH)}
        alt={media.altText || ''}
        style={{ objectPosition: `${posX}% ${posY}%` }}
        className={loaded ? 'is-loaded' : undefined}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setImgError(true)}
        draggable={false}
      />
      {isAdmin && !adjusting && (
        <button
          className="tour-image-adjust-btn"
          onClick={(e) => { e.stopPropagation(); setAdjusting(true); }}
          title="Adjust image position"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1v10M1 6h10" />
            <path d="M6 1L4 3M6 1l2 2M6 11L4 9M6 11l2-2M1 6l2-2M1 6l2 2M11 6l-2-2M11 6l-2 2" />
          </svg>
        </button>
      )}
      {adjusting && (
        <div className="tour-image-adjust-controls">
          <button className="tour-image-save-btn" onClick={handleSave}>Save</button>
          <button className="tour-image-cancel-btn" onClick={handleCancel}>Cancel</button>
        </div>
      )}
      {media.attribution && (
        <span className="tour-image-attribution">{media.attribution}</span>
      )}
    </div>
  );
}

export function TourPanel({
  scene,
  sceneIndex,
  totalScenes,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  media,
  isAdmin,
  onMediaCropUpdate,
}) {
  const isFirst = sceneIndex === 0;
  const isLast = sceneIndex === totalScenes - 1;

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (isLast) onComplete();
      else onNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (!isFirst) onPrev();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onSkip();
    }
  }, [isFirst, isLast, onNext, onPrev, onSkip, onComplete]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <aside className="tour-panel">
      <div className="tour-panel-header">
        <span className="tour-scene-counter">
          {sceneIndex + 1} of {totalScenes}
        </span>
        <button
          className="tour-skip-btn"
          onClick={onSkip}
          title="Exit tour"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="tour-panel-body" key={scene.id}>
        {media && (
          <TourImage
            media={media}
            isAdmin={isAdmin}
            onCropUpdate={onMediaCropUpdate}
          />
        )}
        <h3 className="tour-scene-title">{scene.title}</h3>
        <p className="tour-scene-narrative">{scene.narrative}</p>
        {scene.additionalNarrative && (
          <p
            className={
              'tour-scene-narrative tour-scene-additional' +
              (scene.additionalNarrativeStyle === 'italic' ? ' tour-scene-italic' : '')
            }
          >
            {scene.additionalNarrative}
          </p>
        )}
        {scene.thirdNarrative && (
          <p className="tour-scene-narrative tour-scene-third">
            {Array.isArray(scene.thirdNarrative)
              ? scene.thirdNarrative.map((part, i) =>
                  typeof part === 'string'
                    ? part
                    : <span key={i} className="tour-inline-highlight">{part.highlight}</span>
                )
              : scene.thirdNarrative
            }
          </p>
        )}
      </div>

      <div className="tour-panel-footer">
        <button
          className="tour-nav-btn"
          onClick={onPrev}
          disabled={isFirst}
          title="Previous (←)"
        >
          <Icon name="arrow-left" size={14} />
          <span>Back</span>
        </button>

        {isLast ? (
          <button
            className="tour-nav-btn tour-nav-primary"
            onClick={onComplete}
            title="Finish tour (Enter)"
          >
            <span>Finish</span>
          </button>
        ) : (
          <button
            className="tour-nav-btn tour-nav-primary"
            onClick={onNext}
            title="Next (→)"
          >
            <span>Next</span>
            <Icon name="arrow-right" size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}
