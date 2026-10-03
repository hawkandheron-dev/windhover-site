/**
 * The resting label for a harp string: the thing itself, not the sentence
 * about it (owner's call, M3 round 3). Hovering shows the full name.
 *
 *   Council of Nicaea                        → Nicaea
 *   Second Council of Ephesus (Robber Synod) → Ephesus II
 *   The Didache composed                     → Didache
 *   Augustine writes the Confessions         → Confessions
 *   Paul's letter to the Galatians           → Galatians
 *
 * Councils keep only their place: the diamond already says "council".
 * Anything the rules get wrong goes in `overrides` (config.shortLabels),
 * keyed by the landmark's id; a short_name in the data, when the table has
 * one, wins over both.
 */
const ORDINALS = { First: 'I', Second: 'II', Third: 'III', Fourth: 'IV' };
const WORD_NUMBERS = { First: '1', Second: '2', Third: '3' };
const AUTHOR_VERBS = /^.+? (?:writes|delivers|compiles|completes|posts|publishes) (?:the )?/i;
const TRAILING = / (?:composed|written|completed|mentioned|published)$/i;

export function shortLabel(point, overrides = {}) {
  if (!point) return '';
  if (point.shortName) return point.shortName;
  if (overrides[point.id]) return overrides[point.id];
  let name = String(point.name || '').trim();

  // Parentheticals are glosses: "(the Dedication Council)", "(Synod)".
  name = name.replace(/\s*\([^)]*\)/g, '').trim();

  const council = /^(?:(First|Second|Third|Fourth) )?(?:Councils?|Synods?) of (.+)$/i.exec(name);
  if (council) {
    const [, ordinal, place] = council;
    const tidy = place.replace(/ and /g, ' & ');
    return ordinal ? `${tidy} ${ORDINALS[ordinal]}` : tidy;
  }

  name = name.replace(AUTHOR_VERBS, '').replace(TRAILING, '');

  // "Paul's letter to the Galatians" → "Galatians".
  const letter = /^.+?'s (?:letter|epistle) to the (.+)$/i.exec(name);
  if (letter) return letter[1];
  // "First epistle of Clement" → "1 Clement".
  const epistle = /^(First|Second|Third) (?:epistle|letter) of (.+)$/i.exec(name);
  if (epistle) return `${WORD_NUMBERS[epistle[1]]} ${epistle[2]}`;
  // Papyri go by their number: "Gospel of John fragment - P42" → "P42".
  const papyrus = /\bP\d+\b/.exec(name);
  if (papyrus && /fragment/i.test(name)) return papyrus[0];

  return name.replace(/^The /, '');
}
