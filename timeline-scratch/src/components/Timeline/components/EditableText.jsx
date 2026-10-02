/**
 * A piece of record text an admin can edit in place.
 *
 * Wraps text that came from one database column and, for an admin, adds a
 * pencil that opens a one-field popover. Everyone else sees exactly what they
 * saw before — the wrapper renders its children untouched.
 *
 * Two things are deliberate:
 *
 *   The binding is explicit. A caller passes {itemType, pkValue, column}
 *   rather than letting this component infer them, because the view-model
 *   keeps an item's primary key but not its table, and itemType alone is
 *   ambiguous — 'period' means CH_Movements on this timeline and CH_Eras on
 *   the 1.0 one. Guessing would write to the wrong table.
 *
 *   It edits the RAW column value, not the rendered text. A description is
 *   linkified and sanitised on the way to the screen, so saving what is
 *   displayed would feed markup back into the database a round at a time.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getUpdateFn } from '../../EditEntityForm/EditEntityForm.jsx';
import './EditableText.css';

/** Inline rather than from the icon set, which has no pencil. */
function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
         stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 1.5l2 2-6 6-2.5.5.5-2.5 6-6z" />
    </svg>
  );
}

/**
 * Whether a pencil may be offered for this binding.
 *
 * Pulled out as a plain function so the gate can be tested without a DOM: it
 * decides who gets a write affordance, and every clause is load-bearing.
 * RLS would refuse an unauthorised write anyway, but a pencil that always
 * fails is worse than no pencil, and a pencil bound to the wrong table is
 * worse than both.
 */
export function canEditField({ isAdmin, getToken, pkValue, itemType }) {
  return Boolean(isAdmin) && Boolean(getToken) && Boolean(pkValue) && Boolean(getUpdateFn(itemType));
}

export function EditableText({
  children,
  value,
  column,
  itemType,
  pkValue,
  getToken,
  onSaved,
  isAdmin = false,
  multiline = false,
  label,
  placeholder,
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = canEditField({ isAdmin, getToken, pkValue, itemType });

  // Non-admins, and anything we cannot safely bind, get the plain text back.
  if (!canEdit) return children ?? null;

  // An empty column renders nothing, so without this an admin could never add
  // a missing location or description — there would be no pencil to click.
  const body = children ?? (
    <span className="editable-empty">{placeholder || `Add ${label || column}`}</span>
  );

  return (
    <span className="editable-text">
      {body}
      <button
        type="button"
        className="editable-pencil"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title={`Edit ${label || column}`}
        aria-label={`Edit ${label || column}`}
      >
        <PencilIcon />
      </button>
      {editing && (
        <EditPopover
          initialValue={value ?? ''}
          column={column}
          itemType={itemType}
          pkValue={pkValue}
          getToken={getToken}
          multiline={multiline}
          label={label || column}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}
    </span>
  );
}

function EditPopover({
  initialValue, column, itemType, pkValue, getToken, multiline, label, onClose, onSaved,
}) {
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select?.();
  }, []);

  // Every keystroke stops here. With the detail docked as a side panel the
  // timeline still listens for arrow keys, so typing in this box would
  // otherwise pan the canvas behind it.
  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { onClose(); return; }
    // Enter saves a single-line field; a textarea keeps Enter for newlines and
    // takes Cmd/Ctrl+Enter instead, matching the full edit form.
    const submits = multiline ? (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) : e.key === 'Enter';
    if (submits) { e.preventDefault(); save(); }
  }, [multiline, draft, onClose]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return;
    const next = draft.trim();

    if (next === (initialValue ?? '').trim()) { onClose(); return; }

    setError(null);
    setSaving(true);
    try {
      const updateFn = getUpdateFn(itemType);
      // An empty string is stored as NULL, matching the full edit form.
      await updateFn(pkValue, { [column]: next === '' ? null : next }, getToken);
      onSaved?.();
      onClose();
    } catch (err) {
      // Stay open holding the text. Closing over a failed write would look
      // like a save and quietly lose the edit.
      setError(err?.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <span
      className="editable-popover"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label={`Edit ${label}`}
    >
      <span className="editable-popover-label">{label}</span>
      {multiline ? (
        <textarea
          ref={inputRef}
          className="editable-input"
          rows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
        />
      ) : (
        <input
          ref={inputRef}
          className="editable-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
        />
      )}
      {error && <span className="editable-error" role="alert">{error}</span>}
      <span className="editable-popover-actions">
        <span className="editable-hint">{multiline ? '⌘↵ to save' : '↵ to save'}</span>
        <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-action" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </span>
    </span>
  );
}
