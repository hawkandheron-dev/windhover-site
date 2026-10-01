/**
 * "Feedback" — open to everyone, signed in or not.
 *
 * Deliberately not IssueCreatorButton, which is gated to contributors and asks
 * for a title, a type and a section. A stranger with one thought to share
 * should meet one box, so this is one box.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Icon } from '../Timeline/components/Icon.jsx';
import { submitPublicFeedback, FEEDBACK_MAX_LENGTH } from '../../services/feedbackService.js';
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

function FeedbackModal({ onClose }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

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
      await submitPublicFeedback(message);
      setSent(true);
    } catch (err) {
      // Say so rather than showing a thank-you over a dropped request.
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }, [message, sending]);

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

            <div className="feedback-actions">
              <button type="button" className="btn" onClick={onClose} disabled={sending}>Cancel</button>
              <button
                type="submit"
                className="btn btn-action"
                disabled={sending || !message.trim() || tooLong}
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
