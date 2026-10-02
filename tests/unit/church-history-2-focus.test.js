/**
 * computeFocusSet decides which background items sharpen when a foreground
 * figure is focused. It is the whole navigation model of CH Timeline 2.0, so
 * each of its four sources of belonging gets pinned separately.
 */
import { describe, it, expect } from 'vitest';
import { computeFocusSet } from '../../timeline-scratch/src/components/Timeline/utils/focusSet.js';

/** A stand-in for the `index` block churchHistory2Adapter returns. */
function makeIndex() {
  return {
    connectionMap: new Map([
      // Athanasius is tied to a heresiarch (background) and to a fellow
      // church figure (foreground — must not be pulled into the set).
      ['athanasius', [
        { id: 'arius', type: 'opposed' },
        { id: 'gregory-nyssa', type: 'known' },
      ]],
      ['aquinas', []],
    ]),
    eventConnectionMap: new Map([
      ['council-nicaea', ['athanasius', 'arius']],
      ['council-trent', ['aquinas']],
      ['doc-unrelated', ['someone-else']],
    ]),
    movementsByPerson: new Map([
      ['athanasius', [{ movement: { movement_id: 'mov-arianism' }, role: 'opponent' }]],
    ]),
    // Sorted by start, as the adapter guarantees.
    reigns: [
      { id: 'roman-diocletian', start: 284, end: 305 },
      { id: 'roman-constantine', start: 306, end: 337 },
      { id: 'roman-constantius-2', start: 337, end: 361 },
      { id: 'roman-theodosius', start: 379, end: 395 },
      { id: 'hre-frederick-2', start: 1220, end: 1250 },
    ],
    personById: new Map([
      ['athanasius', { person_id: 'athanasius', birth_year: 296, death_year: 373 }],
      ['aquinas', { person_id: 'aquinas', birth_year: 1225, death_year: 1274 }],
      ['undated', { person_id: 'undated', birth_year: null, death_year: null }],
    ]),
    backItemById: new Map([
      ['arius', {}],
      ['mov-arianism', {}],
      ['council-nicaea', {}],
      ['council-trent', {}],
      ['doc-unrelated', {}],
      ['roman-diocletian', {}],
      ['roman-constantine', {}],
      ['roman-constantius-2', {}],
      ['roman-theodosius', {}],
      ['hre-frederick-2', {}],
    ]),
  };
}

describe('computeFocusSet', () => {
  it('is empty with no focused person', () => {
    expect(computeFocusSet(null, makeIndex()).size).toBe(0);
    expect(computeFocusSet('athanasius', null).size).toBe(0);
  });

  it('gathers connections, movements, events and overlapping reigns', () => {
    // Athanasius lived 296–373.
    const focus = computeFocusSet('athanasius', makeIndex());
    expect([...focus].sort()).toEqual([
      'arius',               // named connection
      'council-nicaea',      // event connection
      'mov-arianism',        // movement membership
      'roman-constantine',   // reigned 306–337
      'roman-constantius-2', // reigned 337–361
      'roman-diocletian',    // reigned 284–305, overlapping from his birth
    ]);
  });

  it('excludes reigns that do not overlap the lifespan', () => {
    const focus = computeFocusSet('athanasius', makeIndex());
    // Frederick II reigned 900 years later.
    expect(focus.has('hre-frederick-2')).toBe(false);
    // Theodosius took the throne in 379, six years after Athanasius died.
    expect(focus.has('roman-theodosius')).toBe(false);
  });

  it('leaves foreground figures out — only the background layer sharpens', () => {
    const focus = computeFocusSet('athanasius', makeIndex());
    expect(focus.has('gregory-nyssa')).toBe(false);
  });

  it('leaves out events the person is not tied to', () => {
    const focus = computeFocusSet('athanasius', makeIndex());
    expect(focus.has('doc-unrelated')).toBe(false);
    expect(focus.has('council-trent')).toBe(false);
  });

  it('handles a person with no movements or connections', () => {
    const focus = computeFocusSet('aquinas', makeIndex());
    expect([...focus].sort()).toEqual(['council-trent', 'hre-frederick-2']);
  });

  it('falls back to the asserted links when a person has no dates', () => {
    const index = makeIndex();
    index.connectionMap.set('undated', [{ id: 'arius', type: 'known' }]);
    const focus = computeFocusSet('undated', index);
    // The connection still counts; no reign can be matched without a lifespan.
    expect([...focus]).toEqual(['arius']);
  });

  it('returns an empty set for an unknown person', () => {
    expect(computeFocusSet('nobody', makeIndex()).size).toBe(0);
  });
});
