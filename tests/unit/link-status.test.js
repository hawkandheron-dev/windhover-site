/**
 * Link Status (owner, 2026-10-19): a work or source whose link could not be
 * verified is hidden from readers. An entry with no link has nothing to
 * verify and always shows. Admins see the hidden ones in Expanded view.
 */
import { describe, it, expect } from 'vitest';
import { transformToTimelineFormat } from '../../timeline-scratch/src/data/churchHistory2Adapter.js';
import snapshot from '../e2e/data/lifelines-snapshot.json';

const works = [
  { work_id: 9001, person_id: 'athanasius', name: 'Checked work', text_url: 'https://example.org/a', link_status: 'Verified' },
  { work_id: 9002, person_id: 'athanasius', name: 'Unchecked work', text_url: 'https://example.org/b', link_status: 'Unverified' },
  { work_id: 9003, person_id: 'athanasius', name: 'Work with no link', text_url: null, link_status: 'Unverified' },
  { work_id: 9004, person_id: 'athanasius', name: 'Old row, no column', text_url: 'https://example.org/c' },
  { work_id: 9005, person_id: 'eusebius-caesarea', name: 'Only unchecked', text_url: 'https://example.org/d', link_status: 'Unverified' },
];
const sources = [
  { source_id: 's-ok', title: 'Checked source', url: 'https://example.org/s1', link_status: 'Verified' },
  { source_id: 's-no', title: 'Unchecked source', url: 'https://example.org/s2', link_status: 'Unverified' },
];
const db = () => ({
  people: snapshot.CH_People,
  events: snapshot.CH_Events,
  connections: [],
  sources,
  sourceFigures: [
    { id: 1, source_id: 's-ok', person_id: 'athanasius' },
    { id: 2, source_id: 's-no', person_id: 'athanasius' },
  ],
  works,
  movements: [], movementFigures: [], movementEvents: [], eventConnections: [],
});
const find = (r, id) => [...r.data.people, ...r.backData.people].find(p => p.id === id);

describe('Link Status', () => {
  it('readers get only the verified and the unlinked; the rest is held for the editor', () => {
    const p = find(transformToTimelineFormat(db()), 'athanasius');
    expect(p.works.map(w => w.name)).toEqual(['Checked work', 'Work with no link', 'Old row, no column']);
    expect(p.works.some(w => w.hidden)).toBe(false);
    expect(p.unverifiedWorks.map(w => w.name)).toEqual(['Unchecked work']);
    expect(p.sources.map(s => s.title)).toEqual(['Checked source']);
    expect(p.unverifiedSources.map(s => s.title)).toEqual(['Unchecked source']);
  });

  it('a figure whose every work is unverified has no works', () => {
    const p = find(transformToTimelineFormat(db()), 'eusebius-caesarea');
    expect(p.works).toEqual([]);
  });

  it("Expanded view keeps them, flagged, and holds nothing back", () => {
    const p = find(transformToTimelineFormat(db(), { includeHidden: true }), 'athanasius');
    expect(p.works.find(w => w.name === 'Unchecked work').hidden).toBe(true);
    expect(p.works.find(w => w.name === 'Checked work').hidden).toBeUndefined();
    expect(p.sources.find(s => s.title === 'Unchecked source').hidden).toBe(true);
    expect(p.unverifiedWorks).toEqual([]);
  });

  it('the snapshot carries a status on every work and source', () => {
    for (const r of [...snapshot.CH_Works, ...snapshot.CH_Sources]) {
      expect(['Verified', 'Unverified'], String(r.work_id ?? r.source_id)).toContain(r.link_status);
    }
  });
});
