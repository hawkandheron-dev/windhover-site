/**
 * Inline edit form for People, Events (Points), and Eras (Periods).
 * Rendered inside TimelineModal when an admin clicks "Edit" or a
 * contributor clicks "Suggest a Change".
 *
 * Props:
 *   mode        — 'edit' (default, admin direct save) | 'suggest' (contributor suggestion)
 *   clerkUserId — required when mode='suggest'
 *   item        — null when creating a new entity via suggestion
 *   newEntityType — 'person' | 'point' | 'period' (used only when item is null)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchRawEntity,
  updatePerson,
  updateEvent,
  updateEra,
} from '../../services/entityEditService.js';
import { submitSuggestion } from '../../services/suggestionService.js';
import { makeSupabaseClient } from '../../lib/supabase.ts';
import './EditEntityForm.css';

// ── Field definitions per entity type ─────────────────────────────────────

const PERSON_FIELDS = [
  { key: 'person_id', label: 'ID', type: 'text', readOnly: true },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'birth_date', label: 'Birth Date', type: 'date', defaultValue: '1000-01-01' },
  { key: 'death_date', label: 'Death Date', type: 'date', defaultValue: '1050-01-01' },
  { key: 'birth_year', label: 'Birth Year', type: 'number' },
  { key: 'death_year', label: 'Death Year', type: 'number' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'role_type', label: 'Role Type', type: 'text', placeholder: 'person or emperor' },
  { key: 'era_id', label: 'Era', type: 'era-select' },
  { key: 'is_monarch', label: 'Is Monarch', type: 'checkbox' },
  { key: 'active', label: 'Active (shown on the timeline)', type: 'checkbox' },
  { key: 'monarch_type', label: 'Monarch Type', type: 'text', placeholder: 'roman-unified, frankish, etc.' },
  { key: 'reign_start', label: 'Reign Start', type: 'date' },
  { key: 'reign_end', label: 'Reign End', type: 'date' },
  { key: 'reign_start_year', label: 'Reign Start Year', type: 'number' },
  { key: 'reign_end_year', label: 'Reign End Year', type: 'number' },
  { key: 'reference_url', label: 'Reference URL', type: 'text', placeholder: 'https://en.wikipedia.org/wiki/...' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const EVENT_FIELDS = [
  { key: 'event_id', label: 'ID', type: 'text', readOnly: true },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'event_type', label: 'Event Type', type: 'select', options: ['council', 'document', 'event', 'era'] },
  { key: 'active', label: 'Active (shown on the timeline)', type: 'checkbox' },
  { key: 'event_date', label: 'Event Date', type: 'date' },
  { key: 'end_date', label: 'End Date', type: 'date' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'reference_url', label: 'Reference URL', type: 'text', placeholder: 'https://en.wikipedia.org/wiki/...' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

const ERA_FIELDS = [
  { key: 'era_id', label: 'ID', type: 'text', readOnly: true },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'start_year', label: 'Start Year', type: 'number' },
  { key: 'end_year', label: 'End Year', type: 'number' },
  { key: 'color', label: 'Color', type: 'color' },
  { key: 'reference_url', label: 'Reference URL', type: 'text', placeholder: 'https://en.wikipedia.org/wiki/...' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

export function getFieldDefs(itemType) {
  if (itemType === 'person') return PERSON_FIELDS;
  if (itemType === 'point') return EVENT_FIELDS;
  if (itemType === 'period') return ERA_FIELDS;
  return [];
}

export function getTableConfig(itemType) {
  if (itemType === 'person') return { table: 'CH_People', pk: 'person_id' };
  if (itemType === 'point') return { table: 'CH_Events', pk: 'event_id' };
  if (itemType === 'period') return { table: 'CH_Eras', pk: 'era_id' };
  return null;
}

export function getUpdateFn(itemType) {
  if (itemType === 'person') return updatePerson;
  if (itemType === 'point') return updateEvent;
  if (itemType === 'period') return updateEra;
  return null;
}

/** Map itemType to the entity_type stored in CH_Suggestions */
function toEntityType(itemType) {
  if (itemType === 'point') return 'event';
  if (itemType === 'period') return 'era';
  return itemType; // 'person'
}

// ── Component ─────────────────────────────────────────────────────────────

export function EditEntityForm({ item, itemType, getToken, onSaved, onCancel, mode = 'edit', clerkUserId, newEntityType }) {
  const [formData, setFormData] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveResult, setSaveResult] = useState(null);
  const [eras, setEras] = useState([]);

  const isSuggest = mode === 'suggest';
  const isNew = !item;
  const effectiveItemType = item ? itemType : newEntityType;
  const fieldDefs = getFieldDefs(effectiveItemType);
  const tableConfig = getTableConfig(effectiveItemType);

  // In suggest mode for new entities, hide the ID field (auto-generated from name)
  const adjustedFieldDefs = fieldDefs.filter(f => {
    if (isSuggest && isNew && f.readOnly) return false;
    return true;
  });

  // Fetch eras for the era picker (only when editing person entities)
  const needsEras = fieldDefs.some(f => f.type === 'era-select');
  useEffect(() => {
    if (!needsEras) return;
    let cancelled = false;
    const fetchEras = async () => {
      try {
        const supabase = makeSupabaseClient(getToken);
        const { data, error: eraErr } = await supabase
          .from('CH_Eras')
          .select('era_id, name, start_year, end_year')
          .order('start_year', { ascending: true });
        if (!cancelled && !eraErr && data) {
          setEras(data);
        }
      } catch {
        // Non-critical — era picker will just be empty
      }
    };
    fetchEras();
    return () => { cancelled = true; };
  }, [needsEras, getToken]);

  // Fetch the raw DB row on mount (skip for new entities)
  useEffect(() => {
    if (isNew) {
      // Initialize empty form for new entity with sensible defaults
      const empty = {};
      for (const f of fieldDefs) {
        if (f.type === 'checkbox') {
          empty[f.key] = false;
        } else if (isNew && f.defaultValue) {
          empty[f.key] = f.defaultValue;
        } else {
          empty[f.key] = '';
        }
      }
      setFormData(empty);
      setOriginalData(empty);
      setLoading(false);
      return;
    }

    if (!item || !tableConfig) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRawEntity(tableConfig.table, tableConfig.pk, item.id, getToken)
      .then(row => {
        if (cancelled) return;
        setFormData({ ...row });
        setOriginalData({ ...row });
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message || 'Failed to load entity');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [item?.id, effectiveItemType]);

  const handleChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setSaveResult(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData || !tableConfig) return;

    if (isSuggest) {
      // ── Suggestion mode: submit to CH_Suggestions ──
      setSaving(true);
      setError(null);
      setSaveResult(null);

      try {
        const entityType = toEntityType(effectiveItemType);
        const entityId = isNew ? null : item.id;
        await submitSuggestion(
          { entity_type: entityType, entity_id: entityId, suggested_data: formData },
          clerkUserId,
          getToken,
        );
        setSaveResult({ type: 'success', message: 'Suggestion submitted! An admin will review it.' });
        // Close after a brief delay so user sees the message
        setTimeout(() => onSaved?.(), 1500);
      } catch (err) {
        setError(err.message || 'Failed to submit suggestion');
        setSaveResult({ type: 'error', message: err.message || 'Failed to submit suggestion' });
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── Admin edit mode: direct save ──
    if (!originalData) return;

    const changes = {};
    for (const field of fieldDefs) {
      if (field.readOnly) continue;
      const key = field.key;
      const newVal = formData[key];
      const oldVal = originalData[key];

      const normalizedNew = (newVal === '' || newVal === undefined) ? null : newVal;
      const normalizedOld = (oldVal === '' || oldVal === undefined) ? null : oldVal;

      if (normalizedNew !== normalizedOld) {
        changes[key] = normalizedNew;
      }
    }

    if (Object.keys(changes).length === 0) {
      setSaveResult({ type: 'info', message: 'No changes to save.' });
      return;
    }

    setSaving(true);
    setError(null);
    setSaveResult(null);

    try {
      const updateFn = getUpdateFn(effectiveItemType);
      const pkValue = formData[tableConfig.pk];
      const updated = await updateFn(pkValue, changes, getToken);

      setOriginalData({ ...updated });
      setFormData({ ...updated });
      setSaveResult({ type: 'success', message: 'Saved successfully.' });
      onSaved?.(updated, effectiveItemType);
    } catch (err) {
      setError(err.message || 'Save failed');
      setSaveResult({ type: 'error', message: err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }, [formData, originalData, tableConfig, fieldDefs, effectiveItemType, getToken, onSaved, isSuggest, clerkUserId, isNew, item]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  if (loading) {
    return <div className="edit-form-loading">Loading entity data...</div>;
  }

  if (error && !formData) {
    return (
      <div className="edit-form-error">
        <p>{error}</p>
        <button type="button" className="btn btn-rect" onClick={onCancel}>
          Close
        </button>
      </div>
    );
  }

  const entityLabel = effectiveItemType === 'person' ? 'Person' : effectiveItemType === 'point' ? 'Event' : 'Era';
  const headerText = isSuggest
    ? (isNew ? `Suggest New ${entityLabel}` : `Suggest Changes to ${entityLabel}`)
    : `Edit ${entityLabel}`;

  return (
    <div className={`edit-entity-form${isSuggest ? ' edit-entity-form--suggest' : ''}`} onKeyDown={handleKeyDown}>
      <div className="edit-form-header">
        <h3>{headerText}</h3>
        <span className="edit-form-hint">Ctrl+Enter to {isSuggest ? 'submit' : 'save'}</span>
      </div>

      {isSuggest && (
        <p className="edit-form-suggest-note">
          Your changes will be submitted for admin review. They won't appear on the timeline until approved.
        </p>
      )}

      <div className="edit-form-fields">
        {adjustedFieldDefs.map(field => (
          <EditField
            key={field.key}
            field={field}
            value={formData?.[field.key]}
            onChange={handleChange}
            eras={eras}
          />
        ))}
      </div>

      {saveResult && (
        <div className={`edit-form-result edit-form-result-${saveResult.type}`}>
          {saveResult.message}
        </div>
      )}

      <div className="edit-form-actions">
        <button
          type="button"
          className={`btn btn-rect ${isSuggest ? 'btn-action' : 'btn-accent'}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? (isSuggest ? 'Submitting...' : 'Saving...')
            : (isSuggest ? 'Submit Suggestion' : 'Save Changes')}
        </button>
        <button
          type="button"
          className="btn btn-rect"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Individual field renderer ─────────────────────────────────────────────

function EditField({ field, value, onChange, eras }) {
  const { key, label, type, readOnly, placeholder, options } = field;
  const displayValue = value ?? '';

  if (type === 'date') {
    return (
      <label className="edit-field">
        <span className="edit-field-label">{label}</span>
        <input
          type="date"
          value={displayValue}
          readOnly={readOnly}
          onChange={e => onChange(key, e.target.value)}
        />
      </label>
    );
  }

  if (type === 'era-select') {
    return (
      <label className="edit-field">
        <span className="edit-field-label">{label}</span>
        <select
          value={displayValue}
          disabled={readOnly}
          onChange={e => onChange(key, e.target.value)}
        >
          <option value="">-- Select Era --</option>
          {eras.map(era => (
            <option key={era.era_id} value={era.era_id}>
              {era.name} ({era.start_year}–{era.end_year || '...'})
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (type === 'checkbox') {
    return (
      <label className="edit-field edit-field-checkbox">
        <input
          type="checkbox"
          checked={!!value}
          disabled={readOnly}
          onChange={e => onChange(key, e.target.checked)}
        />
        <span className="edit-field-label">{label}</span>
      </label>
    );
  }

  if (type === 'textarea') {
    return (
      <label className="edit-field edit-field-textarea">
        <span className="edit-field-label">{label}</span>
        <textarea
          value={displayValue}
          readOnly={readOnly}
          placeholder={placeholder}
          rows={4}
          onChange={e => onChange(key, e.target.value)}
        />
      </label>
    );
  }

  if (type === 'select') {
    return (
      <label className="edit-field">
        <span className="edit-field-label">{label}</span>
        <select
          value={displayValue}
          disabled={readOnly}
          onChange={e => onChange(key, e.target.value)}
        >
          <option value="">--</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
    );
  }

  if (type === 'color') {
    return (
      <label className="edit-field edit-field-color">
        <span className="edit-field-label">{label}</span>
        <div className="edit-field-color-group">
          <input
            type="color"
            value={displayValue || '#000000'}
            disabled={readOnly}
            onChange={e => onChange(key, e.target.value)}
          />
          <input
            type="text"
            value={displayValue}
            readOnly={readOnly}
            placeholder="#00acc1"
            onChange={e => onChange(key, e.target.value)}
            className="edit-field-color-text"
          />
        </div>
      </label>
    );
  }

  // Default: text or number input
  return (
    <label className="edit-field">
      <span className="edit-field-label">{label}</span>
      <input
        type={type}
        value={displayValue}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={e => {
          const val = type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
          onChange(key, val);
        }}
      />
    </label>
  );
}
