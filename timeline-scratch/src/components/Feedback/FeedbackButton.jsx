/**
 * "Feedback" — open to everyone, signed in or not.
 *
 * Deliberately not IssueCreatorButton, which is gated to contributors and asks
 * for a title, a type and a section. A stranger with one thought to share
 * should meet one box, so this is one box.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Icon } from '../Timeline/components/Icon.jsx';
import {
  submitPublicFeedback, FEEDBACK_MAX_LENGTH, turnstileSiteKey,
  gateEnabled, requestAccessCode, redeemAccessCode, storedAccessToken, SUBSTACK_URL,
} from '../../services/feedbackService.js';
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
          'error-callback': (code) => {
            onToken('');
            // Turnstile hands back a numeric code that says WHY, and without
            // logging it every failure looks the same from the outside. The
            // common one in practice is a hostname the widget is not
            // registered for — a preview deploy, say, when the key was
            // created for the production domain.
            console.warn('Turnstile challenge failed. Code:', code, 'on host:', window.location.hostname);
            onError?.('The challenge failed. Please try again.');
          },
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

/**
 * Three steps, not one: ask for an email, redeem the code, then write.
 *
 * A reader who verified recently skips the first two — the token is checked
 * server-side on every submission regardless, so the shortcut is a courtesy
 * rather than a trust decision.
 */
function FeedbackModal({ onClose }) {
  const gated = gateEnabled();
  // Someone with a live token, or an ungated site, starts at the message box.
  const [step, setStep] = useState(() => (!gated || storedAccessToken() ? 'write' : 'email'));
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState('');
  const siteKey = turnstileSiteKey();

  // Escape closes, and every keystroke stops here: while the detail panel is
  // docked the timeline still listens for arrow keys.
  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const resetChallenge = useCallback(() => {
    setToken('');
    if (window.turnstile) { try { window.turnstile.reset(); } catch { /* no widget */ } }
  }, []);

  const handleRequestCode = useCallback(async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null); setBusy(true);
    try {
      await requestAccessCode(email, token);
      setStep('code');
    } catch (err) {
      setError(err?.message || 'Could not send a code. Please try again.');
      resetChallenge();                 // the token is spent either way
    } finally { setBusy(false); }
  }, [email, token, busy, resetChallenge]);

  const handleRedeem = useCallback(async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null); setBusy(true);
    try {
      await redeemAccessCode(email, code);
      setStep('write');
    } catch (err) {
      setError(err?.message || 'That code did not work.');
    } finally { setBusy(false); }
  }, [email, code, busy]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null); setBusy(true);
    try {
      await submitPublicFeedback(message, token);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      resetChallenge();
      // The token lapsed mid-session; send them back to the start.
      if (/subscriber email/i.test(err?.message || '')) setStep('email');
    } finally { setBusy(false); }
  }, [message, token, busy, resetChallenge]);

  const remaining = FEEDBACK_MAX_LENGTH - message.length;
  const tooLong = remaining < 0;
  const challengeReady = !siteKey || Boolean(token);

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
        ) : step === 'email' ? (
          <form onSubmit={handleRequestCode}>
            <h2 id="feedback-heading" className="feedback-heading">Feedback</h2>
            <p className="feedback-intro">
              Feedback is open to subscribers of the newsletter. Enter the email you
              subscribe with and we will send you a six-digit code.
            </p>

            <input
              className="feedback-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="you@example.com"
              aria-label="Your subscriber email"
              autoComplete="email"
              required
            />

            {siteKey && <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setError} />}

            {/* Always shown, whether or not the address turns out to be on the
                list. The server answers identically either way, so this is
                what keeps a non-subscriber from reaching a dead end — and it
                is the conversion. */}
            <p className="feedback-subscribe">
              Not subscribed yet?{' '}
              <a href={SUBSTACK_URL} target="_blank" rel="noopener noreferrer">
                Subscribe free on Substack
              </a>, then come back.
            </p>

            {error && <span className="feedback-error" role="alert">{error}</span>}

            <div className="feedback-actions">
              <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-action" disabled={busy || !email.trim() || !challengeReady}>
                {busy ? 'Sending…' : 'Send me a code'}
              </button>
            </div>
          </form>
        ) : step === 'code' ? (
          <form onSubmit={handleRedeem}>
            <h2 id="feedback-heading" className="feedback-heading">Check your email</h2>
            <p className="feedback-intro">
              If <strong>{email}</strong> is subscribed, a six-digit code is on its way.
              It lasts ten minutes. Check your spam folder if it does not appear.
            </p>

            <input
              className="feedback-input feedback-code-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown}
              placeholder="000000"
              aria-label="Your six-digit code"
              autoComplete="one-time-code"
              autoFocus
            />

            <p className="feedback-subscribe">
              Nothing arrived? That address may not be subscribed —{' '}
              <a href={SUBSTACK_URL} target="_blank" rel="noopener noreferrer">subscribe free</a>{' '}
              and try again.
            </p>

            {error && <span className="feedback-error" role="alert">{error}</span>}

            <div className="feedback-actions">
              <button type="button" className="btn" onClick={() => { setStep('email'); setError(null); }} disabled={busy}>
                Back
              </button>
              <button type="submit" className="btn btn-action" disabled={busy || code.length !== 6}>
                {busy ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 id="feedback-heading" className="feedback-heading">Feedback</h2>
            <p className="feedback-intro">
              Spotted a mistake, missing a figure, or have a thought about the timeline?
              Tell us here.
            </p>

            <textarea
              className="feedback-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={7}
              placeholder="What's on your mind?"
              aria-label="Your feedback"
              autoFocus
            />

            <div className="feedback-meta">
              <span className={tooLong ? 'feedback-count feedback-count-over' : 'feedback-count'}>
                {remaining < 300 ? `${remaining.toLocaleString()} characters left` : ''}
              </span>
              {error && <span className="feedback-error" role="alert">{error}</span>}
            </div>

            {/* Only when the gate is OFF. With it on, the access token this
                request carries is a stronger claim than a captcha — it means a
                code reached a subscribed inbox — so asking again would make a
                returning reader solve a puzzle for every note. Mirrors the
                same condition in functions/api/feedback.js; if the two ever
                disagree the button sends a token the server will not accept. */}
            {!gated && siteKey && (
              <TurnstileWidget siteKey={siteKey} onToken={setToken} onError={setError} />
            )}

            <div className="feedback-actions">
              <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
              <button
                type="submit"
                className="btn btn-action"
                disabled={busy || !message.trim() || tooLong || (!gated && !challengeReady)}
              >
                {busy ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
