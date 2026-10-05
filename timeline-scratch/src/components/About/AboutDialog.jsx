/**
 * "About" — what Lifelines is, whose work it draws on, and what it does (and
 * doesn't) do with a reader's data. Lifelines only: the credits page the other
 * apps link to (about.html#credits) is unreachable once the site navigation
 * is gone, and the licences Lifelines relies on ask for credit where readers
 * can find it.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../Timeline/components/Icon.jsx';
import './AboutDialog.css';

export function AboutButton() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="About Lifelines, credits and privacy"
      >
        About
      </button>
      {open && <AboutDialog onClose={close} />}
    </>
  );
}

const ext = { target: '_blank', rel: 'noopener noreferrer' };

export function AboutDialog({ onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.querySelector('.about-close')?.focus({ preventScroll: true });
  }, []);

  // Escape closes; Tab stays inside; and every keystroke stops here, since
  // the timeline behind listens for arrow keys.
  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll('a[href], button');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [onClose]);

  return (
    <div className="about-overlay" onClick={onClose} onKeyDown={handleKeyDown} role="presentation">
      <div
        ref={dialogRef}
        className="about-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-heading"
      >
        <div className="about-head">
          <h2 id="about-heading" className="about-heading">About Lifelines</h2>
          <button type="button" className="about-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="about-body">
          <p>
            Lifelines is a church history timeline by lifespans, made by Windhover.
            It shows who was alive at the same time, and how the faith passed from
            one generation to the next.
          </p>
          <p>
            The timeline&rsquo;s selection of people, dates and connections, and
            the tour text, are shared under{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" {...ext}>CC BY 4.0</a>:
            you may reuse them, with credit to Matt Brown.
          </p>

          <h3 className="about-subheading">Credits</h3>
          <ul className="about-list">
            <li>
              Article summaries in the detail panel are from{' '}
              <a href="https://www.wikipedia.org/" {...ext}>Wikipedia</a>, under{' '}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/" {...ext}>CC BY-SA 4.0</a>.
              Each links to its article.
            </li>
            <li>
              Maps &copy;{' '}
              <a href="https://www.openhistoricalmap.org/copyright" {...ext}>OpenHistoricalMap</a>{' '}
              contributors (ODbL), drawn with{' '}
              <a href="https://maplibre.org/" {...ext}>MapLibre</a>.
            </li>
            <li>
              Pictures in the tour are from{' '}
              <a href="https://commons.wikimedia.org/" {...ext}>Wikimedia Commons</a>,
              each credited and linked where it appears.
            </li>
            <li>
              Type is Cormorant and Alegreya Sans, under the{' '}
              <a href="https://openfontlicense.org/" {...ext}>SIL Open Font License</a>.
            </li>
          </ul>

          <h3 className="about-subheading">Privacy</h3>
          <ul className="about-list">
            <li>No accounts, no advertising and no tracking cookies.</li>
            <li>
              Visits are counted with Cloudflare Web Analytics, which sets no
              cookies and doesn&rsquo;t follow you across sites.
            </li>
            <li>Fonts are served from this site, not from Google.</li>
            <li>
              If you send feedback, your message and email address reach us by
              email (sent through Resend), after a Cloudflare Turnstile check
              that you&rsquo;re not a bot. We use your address only to reply.
            </li>
            <li>
              The timeline&rsquo;s data loads from our database host, Supabase.
              Opening an entry fetches its summary from Wikipedia and its map
              from OpenHistoricalMap, so those services see the request.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
