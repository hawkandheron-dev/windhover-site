/**
 * Admins' "Expanded view" (owner, 2026-10-10): the adapter keeps inactive
 * figures and events, and minor events, flagged `hidden`, instead of
 * dropping them. The public view is unchanged.
 */
import { describe, it, expect } from 'vitest';
import { transformToTimelineFormat } from '../../timeline-scratch/src/data/churchHistory2Adapter.js';
import snapshot from '../e2e/data/lifelines-snapshot.json';

const db = () => ({
  people: snapshot.CH_People,
  events: snapshot.CH_Events,
  connections: snapshot.CH_Connections || [],
  sources: snapshot.CH_Sources || [],
  sourceFigures: snapshot.CH_Source_Figures || [],
  works: snapshot.CH_Works || [],
  movements: snapshot.CH_Movements || [],
  movementFigures: snapshot.CH_Movement_Figures || [],
  movementEvents: snapshot.CH_Movement_Events || [],
  eventConnections: snapshot.CH_EventConnections || [],
});
const all = (r) => [...r.data.people, ...r.backData.people];

describe('Expanded view', () => {
  it('the public view has nothing hidden in it', () => {
    const r = transformToTimelineFormat(db());
    expect(all(r).some(p => p.hidden)).toBe(false);
    expect(r.data.points.some(p => p.hidden)).toBe(false);
  });

  it('keeps every inactive figure and every hidden event, flagged', () => {
    const pub = transformToTimelineFormat(db());
    const exp = transformToTimelineFormat(db(), { includeHidden: true });
    const inactivePeople = snapshot.CH_People.filter(p => p.active === false && p.doctrinal_role !== 'heresiarch');
    expect(inactivePeople.length).toBeGreaterThan(0);
    const hiddenPeople = all(exp).filter(p => p.hidden).map(p => p.id).sort();
    expect(hiddenPeople).toEqual(inactivePeople.map(p => p.person_id).sort());
    expect(all(exp).length).toBe(all(pub).length + inactivePeople.length);

    const hiddenEvents = snapshot.CH_Events.filter(e => e.active === false || e.significance === 'minor');
    expect(exp.data.points.filter(p => p.hidden)).toHaveLength(hiddenEvents.length);
    expect(exp.data.points.filter(p => p.minor).every(p => p.hidden)).toBe(true);
  });
});

describe('stripHidden', () => {
  it('drops exactly the hidden people and points, and leaves a clean dataset alone', async () => {
    const { stripHidden } = await import('../../timeline-scratch/src/data/churchHistory2Adapter.js');
    const exp = transformToTimelineFormat(db(), { includeHidden: true });
    const pub = transformToTimelineFormat(db());
    const stripped = stripHidden(exp.data);
    expect(stripped.people.map(p => p.id).sort()).toEqual(pub.data.people.map(p => p.id).sort());
    expect(stripped.points.map(p => p.id).sort()).toEqual(pub.data.points.map(p => p.id).sort());
    expect(stripHidden(pub.data)).toBe(pub.data);
    expect(stripHidden(null)).toBe(null);
  });
});
