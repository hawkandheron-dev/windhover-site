import { describe, it, expect } from 'vitest';
import { shortLabel } from '../../timeline-scratch/src/components/Timeline/utils/shortLabel.js';
import { churchHistory2Config } from '../../timeline-scratch/src/data/churchHistory2Data.js';
import snapshot from '../e2e/data/lifelines-snapshot.json';

// Every active landmark in the snapshot, with the resting label Matthew
// reviewed (M3 round 3). A new name that the rules mangle should fail here
// and get an override in churchHistory2Config.shortLabels.
const EXPECTED = new Map([
    ["Paul's letter to the Galatians", "Galatians"],
    ["Council of Jerusalem", "Jerusalem"],
    ["Gospel of Mark completed", "Gospel of Mark"],
    ["Paul's letter to the Philippians", "Philippians"],
    ["The Didache composed", "Didache"],
    ["First epistle of Clement", "1 Clement"],
    ["Gospel of John fragment - P42", "P42"],
    ["The Shepherd of Hermas", "Shepherd of Hermas"],
    ["Muratorian Canon", "Muratorian Canon"],
    ["Pauline epistle fragment - P46", "P46"],
    ["Irenaeus writes Against Heresies", "Against Heresies"],
    ["Origen writes On First Principles", "On First Principles"],
    ["Gospel of Thomas mentioned", "Gospel of Thomas"],
    ["Origen compiles the Hexapla", "Hexapla"],
    ["Synod of Antioch", "Antioch"],
    ["Council of Arles", "Arles"],
    ["Athanasius writes On the Incarnation", "On the Incarnation"],
    ["Arius writes the Thalia", "Thalia"],
    ["Eusebius writes Ecclesiastical History", "Ecclesiastical History"],
    ["Council of Nicaea", "Nicaea"],
    ["Codex Vaticanus written", "Codex Vaticanus"],
    ["The Nicene Creed", "Nicene Creed"],
    ["Council of Antioch (the Dedication Council)", "Antioch"],
    ["Council of Serdica", "Serdica"],
    ["Cyril of Jerusalem delivers the Catechetical Lectures", "Catechetical Lectures"],
    ["Codex Sinaiticus written", "Codex Sinaiticus"],
    ["Councils of Ariminum and Seleucia", "Ariminum & Seleucia"],
    ["Hilary writes De Trinitate", "De Trinitate"],
    ["Synod of Alexandria", "Alexandria"],
    ["Athanasian canon", "Athanasian canon"],
    ["Epiphanius writes the Panarion", "Panarion"],
    ["First Council of Constantinople", "Constantinople I"],
    ["The Niceno-Constantinopolitan Creed", "Niceno-Constantinopolitan Creed"],
    ["Augustine writes the Confessions", "Confessions"],
    ["Jerome completes the Vulgate", "Vulgate"],
    ["Augustine writes The City of God", "City of God"],
    ["Council of Carthage", "Carthage"],
    ["Cyril's Twelve Anathemas", "Twelve Anathemas"],
    ["Council of Ephesus", "Ephesus"],
    ["The Formula of Reunion", "Formula of Reunion"],
    ["Second Council of Ephesus (the Robber Synod)", "Ephesus II"],
    ["The Tome of Leo", "Tome of Leo"],
    ["Council of Chalcedon", "Chalcedon"],
    ["The Chalcedonian Definition", "Chalcedonian Definition"],
    ["Rule of Saint Benedict written", "Rule of Saint Benedict"],
    ["Synod of Whitby", "Whitby"],
    ["Bede writes Ecclesiastical History", "Ecclesiastical History"],
    ["Second Council of Nicaea", "Nicaea II"],
    ["Council (Synod) of Frankfurt", "Frankfurt"],
    ["Book of Kells composed", "Book of Kells"],
    ["Aquinas writes the Summa Theologica", "Summa Theologica"],
    ["Dante writes the Divine Comedy", "Divine Comedy"],
    ["Julian of Norwich writes Revelations of Divine Love", "Revelations of Divine Love"],
    ["Thomas a Kempis writes The Imitation of Christ", "Imitation of Christ"],
    ["Luther posts the 95 Theses", "95 Theses"],
    ["Calvin writes the Institutes of the Christian Religion", "Institutes"],
    ["Copernicus writes De Revolutionibus", "De Revolutionibus"],
    ["Council of Trent", "Trent"],
    ["King James Bible published", "King James Bible"],
    ["Bunyan writes The Pilgrim's Progress", "Pilgrim's Progress"],
]);

describe('shortLabel', () => {
  it('gives every current landmark its reviewed short label', () => {
    const events = snapshot.CH_Events.filter(e => e.active !== false);
    expect(events.length).toBe(EXPECTED.size);
    for (const e of events) {
      expect(shortLabel({ id: e.event_id, name: e.name }, churchHistory2Config.shortLabels), e.name)
        .toBe(EXPECTED.get(e.name));
    }
  });

  it('prefers a short name from the data, then an override', () => {
    expect(shortLabel({ id: 'x', name: 'Council of Nicaea', shortName: 'Nicaea I' }, { x: 'No' })).toBe('Nicaea I');
    expect(shortLabel({ id: 'x', name: 'Council of Nicaea' }, { x: 'Override' })).toBe('Override');
  });

  it('copes with empty input', () => {
    expect(shortLabel(null)).toBe('');
    expect(shortLabel({ id: 'x' })).toBe('');
  });
});
