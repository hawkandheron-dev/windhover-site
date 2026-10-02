/**
 * "Feedback" — open to everyone, signed in or not.
 *
 * Deliberately not IssueCreatorButton, which is gated to contributors and asks
 * for a title, a type and a section. A stranger with one thought to share
 * should meet one box, so this is one box.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Icon } from '../Timeline/components/Icon.jsx';
import { submitPublicFeedback, FEEDBACK_MAX_LENGTH, turnstileSiteKey } from '../../services/feedbackService.js';
import './FeedbackButton.css';

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen(true)}
        title="Tell us what you think — no account needed"
      >
        <Icon name="book" size={14} />
        {' '}Feedback
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The Turnstile challenge.
 *
 * The script is loaded on demand rather than in the page head: almost nobody
 * opens this dialog, and a captcha script on every page view is a tracker
 * every reader pays for. Rendering explicitly (not via auto-detection of the
 * markup) is what lets us mount it inside a dialog that did not exist when the
 * script loaded.
 */
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileLoader = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  // One shared promise: two dialogs in a session must not inject two scripts.
  turnstileLoader ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => { turnstileLoader = null; reject(new Error('Could not load the challenge.')); };
    document.head.appendChild(script);
  });
  return turnstileLoader;
}

function TurnstileWidget({ siteKey, onToken, onError }) {
  const holderRef = useRef(null);

  useEffect(() => {
    let widgetId = null;
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !holderRef.current) return;
        widgetId = turnstile.render(holderRef.current, {
          sitekey: siteKey,
          callback: onToken,
          // A token is single-use and expires; clear it so a stale one is
          // never sent, and let the widget re-challenge.
          'expired-callback': () => onToken(''),
          'error-callback': () => { onToken(''); onError?.('The challenge failed. Please try again.'); },
        });
      })
      .catch((err) => { if (!cancelled) onError?.(err.message); });

    return () => {
      cancelled = true;
      if (widgetId !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId); } catch { /* already gone */ }
      }
    };
  }, [siteKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="feedback-turnstile" ref={holderRef} />;
}

function FeedbackModal({ onClose }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState('');
  const textareaRef = useRef(null);
  const siteKey = turnstileSiteKey();

  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Escape closes, and the keydown stops here: while the detail panel is
  // docked the timeline still listens for arrow keys, so an un-stopped
  // keystroke would pan the canvas behind this dialog as you type.
  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (sending) return;

    setError(null);
    setSending(true);
    try {
      await submitPublicFeedback(message, token);
      setSent(true);
    } catch (err) {
      // Say so rather than showing a thank-you over a dropped request. The
      // token is spent either way, so reset the widget for another attempt.
      setError(err?.message || 'Something went wrong. Please try again.');
      setToken('');
      if (window.turnstile) { try { window.turnstile.reset(); } catch { /* no widget */ } }
    } finally {
      setSending(false);
    }
  }, [message, token, sending]);

  const remaining = FEEDBACK_MAX_LENGTH - message.length;
  const tooLong = remaining < 0;

  return (
    <div className="feedback-overlay" onClick={onClose} onKeyDown={handleKeyDown} role="presentation">
      <div
        className="feedback-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-heading"
      >
        {sent ? (
          <>
            <h2 id="feedback-heading" className="feedback-heading">Thank you</h2>
            <p className="feedback-intro">Your note reached us. We read every one.</p>
            <div className="feedback-actions">
              <button type="button" className="btn btn-action" onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 id="feedback-heading" className="feedback-heading">Feedback</h2>
            <p className="feedback-intro">
              Spotted a mistake, missing a figure, or have a thought about the timeline?
              Tell us here — no account needed.
            </p>

            <textarea
              ref={textareaRef}
              className="feedback-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={7}
              placeholder="What's on your mind?"
              aria-label="Your feedback"
            />

            <div className="feedback-meta">
              {/* Only worth showing as the limit comes into view. */}
              <span className={tooLong ? 'feedback-count feedback-count-over' : 'feedback-count'}>
                {remaining < 300 ? `${remaining.toLocaleString()} characters left` : ''}
              </span>
              {error && <span className="feedback-error" role="alert">{error}</span>}
            </div>

            {siteKey && (
              <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setError} />
            )}

            <div className="feedback-actions">
              <button type="button" className="btn" onClick={onClose} disabled={sending}>Cancel</button>
              <button
                type="submit"
                className="btn btn-action"
                disabled={sending || !message.trim() || tooLong || (Boolean(siteKey) && !token)}
              >
                {sending ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
