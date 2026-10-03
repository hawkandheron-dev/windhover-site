import { useEffect, useRef } from 'react';
import { Icon } from './Timeline/components/Icon.jsx';
import './SiteNavPanel.css';

/**
 * SiteNavPanel — Left slide-in overlay with the site's primary nav.
 *
 * Visual language matches the Tour panel (see components/Tour/TourPanel.css):
 * parchment card, subtle border, soft drop shadow. Unlike TourPanel this is
 * a fixed-position overlay with a backdrop, anchored on the left.
 *
 * The hamburger button lives elsewhere (in the app header); this component
 * renders the panel that the button toggles.
 *
 * Props:
 *   open       — whether the panel is visible
 *   onClose    — callback when the user closes the panel (Esc, backdrop
 *                click, close button, or clicking a link)
 *   activeKey  — which nav key is the current page; that item gets the
 *                highlighted style
 */
const NAV_ITEMS = [
  { key: 'home',                href: '/home.html',                           label: 'Home' },
  { key: 'church-history',      href: './church-history-timeline.html',       label: 'CH Timeline' },
  { key: 'church-history-2',    href: './church-history-2.html',              label: 'Lifelines' },
  { key: 'heresies',            href: './heresies.html',                      label: 'Heresies & councils' },
  { key: 'pantheons',           href: '../../pantheons-supabase.html',        label: 'Pantheons' },
  { key: 'biblical-atlas',      href: './biblical-places.html',               label: 'Biblical atlas' },
  { key: 'timeline',            href: './index.html',                         label: 'Timeline component' },
  { key: 'contributor-portal',  href: './contributor-portal.html',            label: 'Contributor portal' },
  { key: 'arthuriana',          href: './arthuriana.html',                    label: 'Arthuriana' },
];

export function SiteNavPanel({ open, onClose, activeKey }) {
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    // Focus the close button for keyboard users.
    closeBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="site-nav-panel-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="site-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
      >
        <div className="site-nav-panel-header">
          <span className="site-nav-panel-title">Navigate</span>
          <button
            ref={closeBtnRef}
            className="site-nav-panel-close"
            onClick={onClose}
            aria-label="Close navigation"
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <nav className="site-nav-panel-body" aria-label="Primary">
          <ul className="site-nav-panel-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <a
                  href={item.href}
                  className={
                    'site-nav-panel-item' +
                    (item.key === activeKey ? ' is-active' : '')
                  }
                  aria-current={item.key === activeKey ? 'page' : undefined}
                  onClick={onClose}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
