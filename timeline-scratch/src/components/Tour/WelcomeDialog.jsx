import { useEffect, useRef } from 'react';
import './WelcomeDialog.css';

/**
 * `manageFocus` (Lifelines) makes this a proper dialog for the keyboard: it
 * takes focus on its main button when it opens, so a keyboard reader can
 * answer it without tabbing through the whole page behind it.
 */
export function WelcomeDialog({ onStartTour, onDismiss, title = 'Welcome to the Church History Timeline', manageFocus = false }) {
  const primaryRef = useRef(null);
  useEffect(() => {
    if (manageFocus) primaryRef.current?.focus({ preventScroll: true });
  }, [manageFocus]);

  return (
    <div className="welcome-overlay" onClick={onDismiss}>
      <div
        className="welcome-dialog"
        onClick={e => e.stopPropagation()}
        {...(manageFocus && { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'welcome-title' })}
      >
        <h2 className="welcome-title" id={manageFocus ? 'welcome-title' : undefined}>{title}</h2>
        <p className="welcome-text">
          This interactive timeline maps the overlapping lifespans of key figures
          in church history — revealing how the faith was passed from generation
          to generation through personal, living connections.
        </p>
        <p className="welcome-text">
          Would you like a brief guided tour?
        </p>
        <div className="welcome-actions">
          <button ref={primaryRef} className="welcome-btn welcome-btn-primary" onClick={onStartTour}>
            Take the Tour
          </button>
          <button className="welcome-btn welcome-btn-secondary" onClick={onDismiss}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
