/**
 * Modal component for displaying full timeline item details.
 *
 * Changes from original:
 *  - Delete person/point with "Are you sure?" confirmation
 *  - Works displayed as comma-separated hyperlinks (not a list)
 *  - Edit mode for Works, Sources, and Connections (save keeps modal open)
 *  - PointConnections: events/texts can be related to People
 *  - Description shown for People if present
 *  - Wikipedia/Britannica attribution moved to top ("From Wikipedia")
 */

import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { formatDateRange, formatYear, getYear } from '../utils/dateUtils.js';
import { Icon } from './Icon.jsx';
import { EditableText } from './EditableText.jsx';
import { sanitizeHtml } from '../../../utils/sanitize.js';
import { getWorksForAuthor } from '../../../data/works.js';
import { fetchDescription } from '../../../services/wikipediaService.js';
import {
  deletePerson,
  deletePoint,
  updateWorksForPerson,
  updateSourcesForPerson,
  updateConnectionsForPerson,
  updateEventConnections,
} from '../../../services/timelineItemService.js';
import { PeopleSelector } from '../../Notes/PeopleSelector.jsx';
import { NotesSection } from '../../Notes/NotesSection.jsx';
import { EditEntityForm } from '../../EditEntityForm/EditEntityForm.jsx';
import { HistoricalMap } from './HistoricalMap.jsx';
import './TimelineModal.css';

function linkifyDescription(description, itemIndex, currentItemId) {
  if (!description || !itemIndex) return description;

  try {
    // Extract and strip trailing Wikipedia/Britannica URLs from the description,
    // replacing them with a styled "Read more on Wikipedia" link.
    const urlPattern = /\s*(https?:\/\/(?:en\.wikipedia\.org|www\.britannica\.com)\S+)\s*$/;
    const urlMatch = description.match(urlPattern);
    let cleanedDescription = description;
    let wikiLinkHtml = '';
    if (urlMatch) {
      cleanedDescription = description.slice(0, urlMatch.index).trim();
      const url = urlMatch[1];
      const source = url.includes('wikipedia.org') ? 'Wikipedia' : 'Britannica';
      wikiLinkHtml = ` <a class="modal-wiki-source" href="${url}" target="_blank" rel="noopener noreferrer">Read more on ${source}</a>`;
    }

    const entries = Array.from(itemIndex.values())
      .map(({ item: entryItem, type }) => ({
        id: entryItem.id,
        name: entryItem.name,
        type
      }))
      .filter(entry => entry.name && entry.id !== currentItemId)
      .map(entry => ({ ...entry, lowerName: entry.name.toLowerCase() }))
      .sort((a, b) => b.name.length - a.name.length);

    if (entries.length === 0) return cleanedDescription + wikiLinkHtml;

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${cleanedDescription}</div>`, 'text/html');
    const root = doc.body.firstChild;
    if (!root) return description;

    const textNodes = [];
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node?.parentElement) continue;
      if (node.parentElement.closest('a, button')) continue;
      if (!node.textContent?.trim()) continue;
      textNodes.push(node);
    }

    const isWordChar = (char) => /[A-Za-z0-9]/.test(char);

    textNodes.forEach(node => {
      const text = node.textContent;
      const lowerText = text.toLowerCase();
      let position = 0;
      const fragment = doc.createDocumentFragment();

      while (position < text.length) {
        let bestMatch = null;

        entries.forEach(entry => {
          const index = lowerText.indexOf(entry.lowerName, position);
          if (index === -1) return;

          const beforeChar = index > 0 ? text[index - 1] : '';
          const afterChar = text[index + entry.name.length] || '';
          if ((beforeChar && isWordChar(beforeChar)) || (afterChar && isWordChar(afterChar))) {
            return;
          }

          if (
            !bestMatch
            || index < bestMatch.index
            || (index === bestMatch.index && entry.name.length > bestMatch.entry.name.length)
          ) {
            bestMatch = { index, entry };
          }
        });

        if (!bestMatch) {
          fragment.appendChild(doc.createTextNode(text.slice(position)));
          break;
        }

        if (bestMatch.index > position) {
          fragment.appendChild(doc.createTextNode(text.slice(position, bestMatch.index)));
        }

        const button = doc.createElement('button');
        button.setAttribute('type', 'button');
        button.className = 'modal-reference';
        button.textContent = text.slice(bestMatch.index, bestMatch.index + bestMatch.entry.name.length);
        button.setAttribute('data-item-id', bestMatch.entry.id);
        button.setAttribute('data-item-type', bestMatch.entry.type);
        fragment.appendChild(button);

        position = bestMatch.index + bestMatch.entry.name.length;
      }

      node.replaceWith(fragment);
    });

    return root.innerHTML + wikiLinkHtml;
  } catch (error) {
    console.warn('Failed to linkify modal description:', error);
    return description;
  }
}

/**
 * @param {'modal'|'panel'} [variant] - 'modal' (default) is the centred
 *   dialog every timeline has used: a backdrop, the page frozen behind it.
 *   'panel' docks the same content down the right-hand side as a flex sibling
 *   of the timeline, leaving it live — which is what CH Timeline 2.0 needs, so
 *   a figure's background stays in focus while you read about them.
 */
export function TimelineModal({ isOpen, item, itemType, config, onClose, itemIndex, onSelectItem, authContext, allPeople, onItemDeleted, onDataChanged, adminContext, contributorContext, onEntityUpdated, variant = 'modal' }) {
  const isPanel = variant === 'panel';

  // One binding for every pencil in this panel. Built here rather than inside
  // EditableText because only the caller knows which table an item came from:
  // the view-model carries the primary key but not the table, and itemType
  // alone cannot tell CH_Movements from CH_Eras.
  const editBinding = {
    itemType,
    pkValue: item?.id,
    getToken: adminContext?.getToken,
    isAdmin: Boolean(adminContext?.isAdmin),
    onSaved: onEntityUpdated,
  };
  // CH Timeline 2.0 shows one "Works & Sources" section; the 1.0 pages keep
  // the two they have. Works and Sources sit far apart in this render, so the
  // merged form hoists the sources list up into the works block.
  const mergeWorksAndSources = config?.mergeWorksAndSources === true;
  // config.panelLayout === 'compact' (Lifelines): the description leads and a
  // smaller map follows it, with headings in sentence case. On an event the
  // map was the largest thing in the panel, ahead of what the event was.
  const compactLayout = config?.panelLayout === 'compact';
  const hasSources = Boolean(item?.sources?.length);
  // ── Delete confirmation state ──────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // ── Edit mode state ────────────────────────────────────────────────────
  const [editSection, setEditSection] = useState(null); // 'works' | 'sources' | 'connections' | 'pointConnections' | null
  const [editWorks, setEditWorks] = useState([]);
  const [editSources, setEditSources] = useState([]);
  const [editConnections, setEditConnections] = useState([]);
  const [editPointPeople, setEditPointPeople] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [editing, setEditing] = useState(false);

  // Reset state when item changes
  useEffect(() => {
    setDeleteConfirm(false);
    setDeleting(false);
    setDeleteError(null);
    setEditSection(null);
    setSaving(false);
    setSaveError(null);
    setEditing(false);
  }, [item?.id]);

  // config.manageFocus (Lifelines): opening moves focus to the title, so a
  // keyboard or screen-reader reader lands in the panel they just opened;
  // closing hands it back to whatever had it (usually the search box). Search
  // is Lifelines' keyboard route to every figure (DESIGN.md §8), so without
  // this the route ended at a panel the keyboard couldn't reach.
  const manageFocus = config?.manageFocus === true;
  const titleRef = useRef(null);
  // Remember who had focus when the panel opened, and hand it back in the
  // cleanup, which runs whether the panel closes or is unmounted (Lifelines
  // unmounts it on close, so an effect keyed on isOpen === false never ran).
  useEffect(() => {
    if (!manageFocus || !isOpen) return;
    const opener = document.activeElement;
    return () => {
      if (opener && opener !== document.body && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [manageFocus, isOpen]);
  // Each item shown (including one reached from a related-people link) moves
  // focus to its title, so the reader hears what they opened.
  useEffect(() => {
    if (manageFocus && isOpen) titleRef.current?.focus({ preventScroll: true });
  }, [manageFocus, isOpen, item?.id]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(e) {
      if (e.key === 'Escape') {
        if (deleteConfirm) {
          setDeleteConfirm(false);
        } else if (editSection) {
          setEditSection(null);
        } else {
          onClose();
        }
      }
    }

    document.addEventListener('keydown', handleEscape);

    // Only the centred variant takes the page hostage. The docked panel has
    // its own scroll container and sits beside a timeline that must stay
    // pannable, so it leaves the body alone.
    if (!isPanel) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (!isPanel) {
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
      }
    };
  }, [isOpen, onClose, deleteConfirm, editSection, isPanel]);

  const connections = useMemo(() => {
    if (itemType !== 'person' || !item?.connections?.length || !itemIndex) return [];
    return item.connections
      .map(connection => {
        const entry = itemIndex.get(connection.id);
        if (!entry) return null;
        return {
          id: connection.id,
          type: connection.type || 'known',
          item: entry.item,
          itemType: entry.type
        };
      })
      .filter(Boolean);
  }, [itemType, item, itemIndex]);

  // Resolve connectedPeople for points (event-person connections)
  const pointConnections = useMemo(() => {
    if (itemType !== 'point' || !item?.connectedPeople?.length || !itemIndex) return [];
    return item.connectedPeople
      .map(personId => {
        const entry = itemIndex.get(personId);
        if (!entry || entry.type !== 'person') return null;
        return entry;
      })
      .filter(Boolean);
  }, [itemType, item, itemIndex]);

  const periodEntry = useMemo(() => {
    if (!item?.periodId || !itemIndex) return null;
    const entry = itemIndex.get(item.periodId);
    if (!entry || entry.type !== 'period') return null;
    return entry;
  }, [item, itemIndex]);

  const relatedPoints = useMemo(() => {
    if (!item?.relatedPoints?.length || !itemIndex) return [];
    return item.relatedPoints
      .map(id => {
        const entry = itemIndex.get(id);
        return entry?.type === 'point' ? entry : null;
      })
      .filter(Boolean);
  }, [item, itemIndex]);

  const relatedPeriods = useMemo(() => {
    if (!item?.relatedPeriods?.length || !itemIndex) return [];
    return item.relatedPeriods
      .map(id => {
        const entry = itemIndex.get(id);
        return entry?.type === 'period' ? entry : null;
      })
      .filter(Boolean);
  }, [item, itemIndex]);

  const descriptionHtml = useMemo(() => {
    if (!item?.description) return '';
    return linkifyDescription(item.description, itemIndex, item.id);
  }, [item, itemIndex]);

  const worksForPerson = useMemo(() => {
    if (itemType !== 'person') return [];
    // Prefer works from item data (Supabase), fall back to static lookup
    if (item?.works?.length) return item.works;
    return getWorksForAuthor(item?.name);
  }, [itemType, item?.name, item?.works]);

  const searchQuery = useMemo(() => {
    if (itemType !== 'person') return '';
    const startYear = getYear(item?.startDate);
    const endYear = getYear(item?.endDate);
    const searchYear = (year) => {
      if (!year && year !== 0) return '?';
      return formatYear(year, 'BC/AD', { showAD: false });
    };
    return `${item?.name} (${searchYear(startYear)}-${searchYear(endYear)})`;
  }, [itemType, item?.name, item?.startDate, item?.endDate]);

  const handleReferenceClick = useCallback((event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('[data-item-id]');
    if (!button) return;
    const id = button.getAttribute('data-item-id');
    if (!id || !itemIndex) return;
    const entry = itemIndex.get(id);
    if (!entry) return;
    onSelectItem?.(entry.type, entry.item);
  }, [itemIndex, onSelectItem]);

  const handleModalWheel = useCallback((event) => {
    event.stopPropagation();
  }, []);

  // ── Delete handlers ────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!authContext?.getToken) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (itemType === 'person') {
        await deletePerson(item.id, authContext.getToken);
      } else if (itemType === 'point') {
        await deletePoint(item.id, authContext.getToken);
      }
      onItemDeleted?.(itemType, item.id);
      onClose();
    } catch (err) {
      setDeleteError(err.message || 'Delete failed.');
      setDeleting(false);
    }
  }, [authContext, itemType, item, onItemDeleted, onClose]);

  // ── Edit handlers ──────────────────────────────────────────────────────
  const startEditWorks = useCallback(() => {
    setEditWorks(worksForPerson.map(w => ({ name: w.name, textUrl: w.textUrl || '' })));
    setEditSection('works');
    setSaveError(null);
  }, [worksForPerson]);

  const startEditSources = useCallback(() => {
    const sources = item?.sources || [];
    setEditSources(sources.map(s => ({ ...s })));
    setEditSection('sources');
    setSaveError(null);
  }, [item]);

  const startEditConnections = useCallback(() => {
    const conns = item?.connections || [];
    setEditConnections(conns.map(c => ({ id: c.id, type: c.type || 'known' })));
    setEditSection('connections');
    setSaveError(null);
  }, [item]);

  const startEditPointPeople = useCallback(() => {
    const ppl = item?.connectedPeople || [];
    setEditPointPeople([...ppl]);
    setEditSection('pointConnections');
    setSaveError(null);
  }, [item]);

  const cancelEdit = useCallback(() => {
    setEditSection(null);
    setSaveError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!authContext?.getToken) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editSection === 'works') {
        const cleaned = editWorks.filter(w => w.name.trim());
        await updateWorksForPerson(item.id, cleaned, authContext.getToken);
      } else if (editSection === 'sources') {
        const cleaned = editSources.filter(s => s.title?.trim());
        await updateSourcesForPerson(item.id, cleaned, authContext.getToken);
      } else if (editSection === 'connections') {
        await updateConnectionsForPerson(item.id, editConnections, authContext.getToken);
      } else if (editSection === 'pointConnections') {
        await updateEventConnections(item.id, editPointPeople, authContext.getToken);
      }
      // Save succeeded — stay in modal, exit edit mode, refresh data
      setEditSection(null);
      onDataChanged?.();
    } catch (err) {
      setSaveError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }, [authContext, editSection, editWorks, editSources, editConnections, editPointPeople, item, onDataChanged]);

  // ── Edit Works helpers ─────────────────────────────────────────────────
  const addWork = useCallback(() => {
    setEditWorks(prev => [...prev, { name: '', textUrl: '' }]);
  }, []);

  const removeWork = useCallback((idx) => {
    setEditWorks(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateWork = useCallback((idx, field, value) => {
    setEditWorks(prev => prev.map((w, i) => i === idx ? { ...w, [field]: value } : w));
  }, []);

  // ── Edit Sources helpers ───────────────────────────────────────────────
  const addSource = useCallback(() => {
    setEditSources(prev => [...prev, { title: '', url: '', source: '', year: '', notes: '' }]);
  }, []);

  const removeSource = useCallback((idx) => {
    setEditSources(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateSource = useCallback((idx, field, value) => {
    setEditSources(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }, []);

  // ── Edit Connections helpers ───────────────────────────────────────────
  const addConnection = useCallback((personId) => {
    if (editConnections.some(c => c.id === personId)) return;
    setEditConnections(prev => [...prev, { id: personId, type: 'known' }]);
  }, [editConnections]);

  const removeConnection = useCallback((personId) => {
    setEditConnections(prev => prev.filter(c => c.id !== personId));
  }, []);

  const updateConnectionType = useCallback((personId, type) => {
    setEditConnections(prev => prev.map(c => c.id === personId ? { ...c, type } : c));
  }, []);

  // ── Wikipedia description for People & Points (not Periods) ──────────
  const [wikiDesc, setWikiDesc] = useState(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !item || itemType === 'period') {
      setWikiDesc(null);
      return;
    }

    let cancelled = false;
    setWikiLoading(true);
    setWikiDesc(null);

    fetchDescription(item.name, item.referenceUrl).then(result => {
      if (!cancelled) {
        setWikiDesc(result);
        setWikiLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [isOpen, item?.id, item?.name, item?.referenceUrl, itemType]);

  if (!isOpen || !item) return null;

  const mapBlock = (itemType === 'person' || itemType === 'point') && item.location ? (
    <HistoricalMap
      key={item.id}
      location={item.location}
      birthYear={getYear(item.startDate || item.date)}
      title={compactLayout ? 'Historical map' : undefined}
    />
  ) : null;

  const canEdit = !!authContext?.getToken;

  // Format date based on item type
  let dateString = '';
  if (itemType === 'person') {
    dateString = formatDateRange(
      item.startDate,
      item.endDate,
      item.startCertainty || 'year only',
      item.endCertainty || 'year only',
      config.eraLabels
    );
  } else if (itemType === 'point') {
    dateString = formatDateRange(
      item.date,
      null,
      item.dateCertainty || 'year only',
      null,
      config.eraLabels
    );
  } else if (itemType === 'period') {
    dateString = formatDateRange(
      item.startDate,
      item.endDate,
      item.dateCertainty || 'year only',
      item.dateCertainty || 'year only',
      config.eraLabels
    );
  }

  const sourcesList = (
    <ul className="modal-reference-list">
      {(item.sources || []).map((source) => {
        const metaParts = [source.source, source.year].filter(Boolean);
        const metaText = metaParts.length ? ` (${metaParts.join(', ')})` : '';
        return (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
            {metaText && <span>{metaText}</span>}
            {source.notes && <div>{source.notes}</div>}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className={isPanel ? 'timeline-modal timeline-modal--panel' : 'timeline-modal'}
      // Clicking outside dismisses the centred dialog. The docked panel has no
      // "outside" — it is part of the layout — so it closes from its own button.
      onClick={isPanel ? undefined : onClose}
      onMouseDown={handleModalWheel}
      onMouseUp={handleModalWheel}
      onWheel={handleModalWheel}
      onTouchStart={handleModalWheel}
      onTouchMove={handleModalWheel}
    >
      {!isPanel && <div className="modal-backdrop" />}
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        {...(manageFocus && (isPanel
          ? { role: 'region', 'aria-labelledby': 'timeline-detail-title' }
          : { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'timeline-detail-title' }))}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label={manageFocus ? 'Close details' : 'Close modal'}
        >
          &times;
        </button>

        {item.image && (
          <img
            src={item.image}
            alt={item.name}
            className="modal-image"
          />
        )}

        <h2
          className="modal-title"
          {...(manageFocus && { id: 'timeline-detail-title', ref: titleRef, tabIndex: -1 })}
        >
          {item.isMonarch && (
            <Icon name="crown" size={24} color="#ffd700" className="emperor-crown" />
          )}
          <EditableText {...editBinding} value={item.name} column="name" label="Name">
            {item.name}
          </EditableText>
          {searchQuery && (
            <a
              className="modal-search-link"
              href={`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Search for ${searchQuery}`}
            >
              <Icon name="search" size={14} />
            </a>
          )}
          {adminContext?.isAdmin && (
            <button
              type="button"
              className={`modal-edit-toggle${editing ? ' active' : ''}`}
              onClick={() => setEditing(prev => !prev)}
            >
              {editing ? 'Close Editor' : 'Edit'}
            </button>
          )}
          {!adminContext?.isAdmin && contributorContext?.isContributor && (
            <button
              type="button"
              className={`modal-edit-toggle modal-suggest-toggle${editing ? ' active' : ''}`}
              onClick={() => setEditing(prev => !prev)}
            >
              {editing ? 'Close' : 'Suggest a Change'}
            </button>
          )}
        </h2>

        {dateString && (
          <p className="modal-date">{dateString}</p>
        )}

        {(item.location || editBinding.isAdmin) && (
          <p className="modal-location">
            <EditableText {...editBinding} value={item.location} column="location" label="Location">
              {item.location || null}
            </EditableText>
          </p>
        )}

        {!compactLayout && mapBlock}

        {item.periodName && (
          <p className="modal-period">
            Era:{' '}
            {periodEntry ? (
              <button
                type="button"
                className="modal-reference"
                data-item-id={periodEntry.item.id}
                data-item-type={periodEntry.type}
                onClick={handleReferenceClick}
              >
                {item.periodName}
              </button>
            ) : (
              item.periodName
            )}
          </p>
        )}

        {/* Description — shown for all item types that have one */}
        {(item.description || editBinding.isAdmin) && (
          <div className="modal-description">
            <EditableText
              {...editBinding}
              value={item.description}
              column="description"
              label="Description"
              multiline
            >
              {item.description ? (
                // The rendered HTML is linkified and sanitised; the pencil
                // above edits item.description, the raw column behind it.
                <span
                  onClick={handleReferenceClick}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(descriptionHtml) }}
                />
              ) : null}
            </EditableText>
          </div>
        )}

        {/* Wikipedia / Britannica — attribution at the TOP, "From Wikipedia" */}
        {itemType !== 'period' && (
          <div className="modal-wiki-description">
            {wikiLoading && (
              <p className="modal-wiki-loading">Loading description...</p>
            )}
            {wikiDesc && (
              <>
                <a
                  className="modal-wiki-attribution"
                  href={wikiDesc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  From {wikiDesc.source}
                </a>
                <div
                  className="modal-wiki-text"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(wikiDesc.text) }}
                />
              </>
            )}
          </div>
        )}

        {compactLayout && mapBlock}

        {/* Works / Texts — comma-separated hyperlinks (not a list).
            When merged, the sources list follows under the same heading, and
            the section also appears for a figure who has sources but no works. */}
        {(worksForPerson.length > 0 || (mergeWorksAndSources && hasSources)) && editSection !== 'works' && (
          <div className="modal-links modal-works">
            <h3>
              {mergeWorksAndSources ? 'Works & Sources' : 'Works'}
              {canEdit && worksForPerson.length > 0 && (
                <button type="button" className="modal-edit-btn" onClick={startEditWorks}>Edit</button>
              )}
              {canEdit && mergeWorksAndSources && hasSources && (
                <button type="button" className="modal-edit-btn" onClick={startEditSources}>Edit sources</button>
              )}
            </h3>
            {worksForPerson.length > 0 && (
              <p className="modal-works-inline">
                {worksForPerson.map((work, i) => (
                  <span key={work.name}>
                    {i > 0 && ', '}
                    {work.textUrl ? (
                      <a href={work.textUrl} target="_blank" rel="noopener noreferrer">
                        {work.name}
                      </a>
                    ) : (
                      <span>{work.name}</span>
                    )}
                  </span>
                ))}
              </p>
            )}
            {mergeWorksAndSources && hasSources && editSection !== 'sources' && sourcesList}
          </div>
        )}

        {/* Works — EDIT MODE */}
        {editSection === 'works' && (
          <div className="modal-links modal-edit-section">
            <h3>Edit Works</h3>
            {editWorks.map((work, idx) => (
              <div key={idx} className="modal-edit-row">
                <input
                  type="text"
                  className="modal-edit-input"
                  placeholder="Work title"
                  value={work.name}
                  onChange={e => updateWork(idx, 'name', e.target.value)}
                />
                <input
                  type="url"
                  className="modal-edit-input modal-edit-input-url"
                  placeholder="Text URL (optional)"
                  value={work.textUrl}
                  onChange={e => updateWork(idx, 'textUrl', e.target.value)}
                />
                <button type="button" className="modal-edit-remove" onClick={() => removeWork(idx)}>&times;</button>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={addWork}>+ Add work</button>
            {renderEditActions()}
          </div>
        )}

        {/* Connections — for People */}
        {(connections.length > 0 || (canEdit && itemType === 'person')) && editSection !== 'connections' && (
          <div className="modal-links">
            <h3>
              Connections
              {canEdit && itemType === 'person' && (
                <button type="button" className="modal-edit-btn" onClick={startEditConnections}>
                  {connections.length > 0 ? 'Edit' : '+ Add'}
                </button>
              )}
            </h3>
            {connections.length > 0 && (
              <ul className="modal-reference-list modal-pill-list">
                {connections.map(connection => (
                  <li key={connection.id} className="modal-pill-item">
                    <button
                      type="button"
                      className="modal-pill"
                      data-item-id={connection.id}
                      data-item-type={connection.itemType}
                      onClick={handleReferenceClick}
                    >
                      <span
                        className="summary-color-dot"
                        style={{ backgroundColor: connection.item.color }}
                      />
                      <strong>{connection.item.name}</strong>
                      {connection.item.location && (
                        <span>{'\u00A0'}in <em>{connection.item.location}</em></span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Connections — EDIT MODE */}
        {editSection === 'connections' && (
          <div className="modal-links modal-edit-section">
            <h3>Edit Connections</h3>
            {editConnections.map(conn => {
              const entry = itemIndex?.get(conn.id);
              const name = entry?.item?.name || conn.id;
              return (
                <div key={conn.id} className="modal-edit-row modal-edit-row-conn">
                  <span className="modal-edit-conn-name">{name}</span>
                  <select
                    className="modal-edit-select"
                    value={conn.type}
                    onChange={e => updateConnectionType(conn.id, e.target.value)}
                  >
                    <option value="known">Known</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                    <option value="influenced">Influenced</option>
                    <option value="influenced_by">Influenced by</option>
                    <option value="opponent">Opponent</option>
                    <option value="collaborator">Collaborator</option>
                    <option value="contemporary">Contemporary</option>
                  </select>
                  <button type="button" className="modal-edit-remove" onClick={() => removeConnection(conn.id)}>&times;</button>
                </div>
              );
            })}
            <div className="modal-edit-add-person">
              <PeopleSelector
                people={allPeople || []}
                selectedIds={[]}
                onChange={(ids) => { if (ids.length) addConnection(ids[ids.length - 1]); }}
                excludeId={item.id}
              />
            </div>
            {renderEditActions()}
          </div>
        )}

        {/* Connected People — for Points (event/text → person connections) */}
        {(pointConnections.length > 0 || (canEdit && itemType === 'point')) && editSection !== 'pointConnections' && (
          <div className="modal-links">
            <h3>
              {compactLayout ? 'Related people' : 'Related People'}
              {canEdit && itemType === 'point' && (
                <button type="button" className="modal-edit-btn" onClick={startEditPointPeople}>
                  {pointConnections.length > 0 ? 'Edit' : '+ Add'}
                </button>
              )}
            </h3>
            {pointConnections.length > 0 && (
              <ul className="modal-reference-list modal-pill-list">
                {pointConnections.map(entry => (
                  <li key={entry.item.id} className="modal-pill-item">
                    <button
                      type="button"
                      className="modal-pill"
                      data-item-id={entry.item.id}
                      data-item-type={entry.type}
                      onClick={handleReferenceClick}
                    >
                      <span
                        className="summary-color-dot"
                        style={{ backgroundColor: entry.item.color }}
                      />
                      <strong>{entry.item.name}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Point Connections — EDIT MODE */}
        {editSection === 'pointConnections' && (
          <div className="modal-links modal-edit-section">
            <h3>Edit Related People</h3>
            <div className="modal-edit-pill-list">
              {editPointPeople.map(pid => {
                const entry = itemIndex?.get(pid);
                const name = entry?.item?.name || pid;
                return (
                  <span key={pid} className="modal-edit-pill">
                    {name}
                    <button type="button" className="modal-edit-remove-inline" onClick={() => setEditPointPeople(prev => prev.filter(id => id !== pid))}>&times;</button>
                  </span>
                );
              })}
            </div>
            <PeopleSelector
              people={allPeople || []}
              selectedIds={[]}
              onChange={(ids) => {
                if (ids.length) {
                  const newId = ids[ids.length - 1];
                  if (!editPointPeople.includes(newId)) {
                    setEditPointPeople(prev => [...prev, newId]);
                  }
                }
              }}
              excludeId={null}
            />
            {renderEditActions()}
          </div>
        )}

        {/* Show "Add related people" button for points that have none */}
        {itemType === 'point' && pointConnections.length === 0 && editSection !== 'pointConnections' && canEdit && (
          <div className="modal-links">
            <button type="button" className="btn btn-sm" onClick={startEditPointPeople}>
              + Add related people
            </button>
          </div>
        )}

        {relatedPoints.length > 0 && (
          <div className="modal-links">
            <h3>Related points</h3>
            <ul className="modal-reference-list">
              {relatedPoints.map(point => (
                <li key={point.item.id}>
                  <button
                    type="button"
                    className="modal-reference"
                    data-item-id={point.item.id}
                    data-item-type={point.type}
                    onClick={handleReferenceClick}
                  >
                    {point.item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {relatedPeriods.length > 0 && (
          <div className="modal-links">
            <h3>Related periods</h3>
            <ul className="modal-reference-list">
              {relatedPeriods.map(period => (
                <li key={period.item.id}>
                  <button
                    type="button"
                    className="modal-reference"
                    data-item-id={period.item.id}
                    data-item-type={period.type}
                    onClick={handleReferenceClick}
                  >
                    {period.item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {item.links && item.links.length > 0 && (
          <div className="modal-links">
            <h3>Links:</h3>
            <ul>
              {item.links.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources — for People and Points. Rendered here only when they are
            their own section; the merged form puts them under Works above. */}
        {!mergeWorksAndSources && item.sources && item.sources.length > 0 && editSection !== 'sources' && (
          <div className="modal-links">
            <h3>
              Sources
              {canEdit && (
                <button type="button" className="modal-edit-btn" onClick={startEditSources}>Edit</button>
              )}
            </h3>
            {sourcesList}
          </div>
        )}

        {/* Sources — EDIT MODE */}
        {editSection === 'sources' && (
          <div className="modal-links modal-edit-section">
            <h3>Edit Sources</h3>
            {editSources.map((src, idx) => (
              <div key={idx} className="modal-edit-card">
                <input
                  type="text"
                  className="modal-edit-input"
                  placeholder="Title"
                  value={src.title || ''}
                  onChange={e => updateSource(idx, 'title', e.target.value)}
                />
                <input
                  type="url"
                  className="modal-edit-input"
                  placeholder="URL"
                  value={src.url || ''}
                  onChange={e => updateSource(idx, 'url', e.target.value)}
                />
                <div className="modal-edit-row-pair">
                  <input
                    type="text"
                    className="modal-edit-input"
                    placeholder="Source name"
                    value={src.source || ''}
                    onChange={e => updateSource(idx, 'source', e.target.value)}
                  />
                  <input
                    type="text"
                    className="modal-edit-input modal-edit-input-short"
                    placeholder="Year"
                    value={src.year || ''}
                    onChange={e => updateSource(idx, 'year', e.target.value)}
                  />
                </div>
                <input
                  type="text"
                  className="modal-edit-input"
                  placeholder="Notes (optional)"
                  value={src.notes || ''}
                  onChange={e => updateSource(idx, 'notes', e.target.value)}
                />
                <button type="button" className="modal-edit-remove-card" onClick={() => removeSource(idx)}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={addSource}>+ Add source</button>
            {renderEditActions()}
          </div>
        )}

        {itemType === 'person' && authContext && adminContext?.isAdmin && (
          <NotesSection
            personId={item.id}
            personName={item.name}
            people={allPeople || []}
            getToken={authContext.getToken}
            clerkUserId={authContext.clerkUserId}
            itemIndex={itemIndex}
          />
        )}

        {editing && adminContext?.isAdmin && (
          <EditEntityForm
            item={item}
            itemType={itemType}
            getToken={adminContext.getToken}
            onSaved={(updatedRow, type) => {
              onEntityUpdated?.(updatedRow, type);
            }}
            onCancel={() => setEditing(false)}
          />
        )}

        {editing && !adminContext?.isAdmin && contributorContext?.isContributor && (
          <EditEntityForm
            item={item}
            itemType={itemType}
            getToken={contributorContext.getToken}
            mode="suggest"
            clerkUserId={contributorContext.clerkUserId}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        )}

        {/* Delete button — for People and Points when authenticated */}
        {canEdit && (itemType === 'person' || itemType === 'point') && (
          <div className="modal-delete-section">
            {!deleteConfirm ? (
              <button
                type="button"
                className="modal-delete-btn"
                onClick={() => setDeleteConfirm(true)}
              >
                Delete {itemType === 'person' ? 'person' : 'event'}
              </button>
            ) : (
              <div className="modal-delete-confirm">
                <p className="modal-delete-confirm-text">
                  Are you sure you want to delete <strong>{item.name}</strong>? This cannot be undone.
                </p>
                {deleteError && <p className="note-error">{deleteError}</p>}
                <div className="modal-delete-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-rect btn-accent modal-delete-confirm-btn"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Yes, delete'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-rect"
                    onClick={() => { setDeleteConfirm(false); setDeleteError(null); }}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Shared edit action buttons (Save / Cancel)
  function renderEditActions() {
    return (
      <div className="modal-edit-actions">
        {saveError && <p className="note-error">{saveError}</p>}
        <button
          type="button"
          className="btn btn-rect btn-accent"
          onClick={handleSaveEdit}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          className="btn btn-rect"
          onClick={cancelEdit}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    );
  }
}
