import { describe, it, expect } from 'vitest';
import { isShownEvent } from '../../timeline-scratch/src/data/churchHistory2Adapter.js';
import snapshot from '../e2e/data/lifelines-snapshot.json';

// M3 round 5 (owner's call): major landmarks show, minor ones are hidden.
describe('isShownEvent', () => {
  it('hides minor and inactive rows, and treats a missing significance as major', () => {
    expect(isShownEvent({ active: true, significance: 'major' })).toBe(true);
    expect(isShownEvent({ active: true })).toBe(true);
    expect(isShownEvent({})).toBe(true);
    expect(isShownEvent({ active: true, significance: 'minor' })).toBe(false);
    expect(isShownEvent({ active: false, significance: 'major' })).toBe(false);
  });

  it('leaves exactly the seven ecumenical councils, sixteen events and every text', () => {
    const shown = snapshot.CH_Events.filter(isShownEvent);
    const councils = shown.filter(e => e.event_type === 'council').map(e => e.name).sort();
    expect(councils).toEqual([
      'Council of Chalcedon', 'Council of Ephesus', 'Council of Nicaea',
      'First Council of Constantinople', 'Second Council of Constantinople',
      'Second Council of Nicaea', 'Third Council of Constantinople',
    ]);
    expect(shown.filter(e => e.event_type === 'event')).toHaveLength(16);
    expect(shown.filter(e => e.event_type === 'document'))
      .toHaveLength(snapshot.CH_Events.filter(e => e.event_type === 'document' && e.active !== false).length);
  });
});
