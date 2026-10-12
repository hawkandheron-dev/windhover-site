#!/usr/bin/env node
/**
 * Audit the links under Works & Sources (CH_Works.text_url, CH_Sources.url):
 * does each one go to the work or source it names, or only to its author's page?
 *
 *   node scripts/check-work-links.mjs                 # audit + propose, write .link-audit/
 *   node scripts/check-work-links.mjs --only athanasius,anselm   # some figures
 *   node scripts/check-work-links.mjs --refresh       # ignore the page cache
 *   node scripts/check-work-links.mjs --sql           # also write the sure changes as SQL
 *
 * Reads tests/e2e/data/lifelines-snapshot.json. Before writing a migration, check
 * the snapshot still matches the live tables (scripts/lifelines-snapshot.sql).
 *
 * For each work it:
 *   1. fetches the current link (status, final address, page title);
 *   2. classes it: "work" (the page's title names the work), "author" / "volume"
 *      (a page about the author or a whole book), "dead", or "other";
 *   3. looks for a better address, in order: New Advent's Church Fathers, the
 *      author's CCEL / Wikisource list of works, then a Wikipedia article about the
 *      work. A candidate is only ever proposed after fetching it and reading its
 *      own title: "sure" when that title names the work.
 *
 * Writes .link-audit/report.json and report.md. Pages are cached in
 * .link-audit/cache so a rerun is cheap and polite: about 2 requests a second per
 * host, with a User-Agent that names the project.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.link-audit');
const CACHE = path.join(OUT, 'cache');
const UA = 'WindhoverLinkAudit/1.0 (+https://windhoverhistory.com; link check for a church history timeline)';
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const REFRESH = args.includes('--refresh');
const ONLY = opt('only')?.split(',');


// ── fetching, cached and rate limited ──────────────────────────────────────
const lastHit = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url, { json = false, minGap } = {}) {
  const key = crypto.createHash('sha1').update(url).digest('hex');
  const file = path.join(CACHE, `${key}.json`);
  if (!REFRESH && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const host = new URL(url).hostname;
  // Wikimedia asks for gentle clients and answers 429 to a fast one.
  const gap = minGap ?? (/wiki(pedia|source|media)\.org$/.test(host) ? 800 : 500);
  let result;
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = (lastHit.get(host) ?? 0) + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
    try {
      // curl, not Node's fetch: curl honours the machine's proxy and CA settings.
      const { stdout } = await execFileP('curl', [
        '-sS', '-L', '--max-time', '25', '--max-filesize', '3000000', '-A', UA,
        '-H', `Accept: ${json ? 'application/json' : 'text/html,*/*'}`,
        '-w', '\n%{http_code} %{url_effective}', url,
      ], { maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
      const cut = stdout.lastIndexOf('\n');
      const [code, ...fin] = stdout.slice(cut + 1).split(' ');
      result = { url, status: Number(code), finalUrl: fin.join(' ') || url, body: stdout.slice(0, cut).slice(0, 600000) };
    } catch (err) {
      result = { url, status: 0, finalUrl: url, body: '', error: String(err.stderr || err.message).split('\n')[0].slice(0, 160) };
    }
    if (result.status !== 429) break;
    await sleep(4000 * 2 ** attempt); // back off, then try again
  }
  // A rate limit or a server hiccup is not an answer: do not remember it.
  if (result.status !== 429 && !(result.status >= 500) && result.status !== 0) {
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(result));
  }
  return result;
}

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
const strip = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function pageTitles(html) {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const h = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i.exec(html)?.[1];
  // New Advent's numbered parts ("Treatise 3") put the real title in the first bold line under the heading.
  const lead = /<\/h1>[\s\S]{0,1500}?<p><strong>([^<]{3,100})<\/strong><\/p>/.exec(html)?.[1];
  return [t && strip(t), ...h.slice(0, 2), og && decode(og), lead && strip(lead).replace(/\.$/, '')].filter(Boolean);
}

// ── comparing names ────────────────────────────────────────────────────────
const STOP = new Set(['saint', 'the', 'of', 'on', 'to', 'and', 'a', 'an', 'in', 'de', 'ad', 'against', 'concerning', 'epistle', 'letter', 'letters', 'selected', 'fathers', 'works', 'book', 'books']);
const ORD = {
  first: '1', second: '2', third: '3', i: '1', ii: '2', iii: '3', '1st': '1', '2nd': '2', '3rd': '3',
  // New Advent calls Athanasius's "Orations Against the Arians" "Four Discourses".
  orations: 'discourses', oration: 'discourses', discourse: 'discourses',
  st: 'saint', in: 'on',
};

export function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function tokens(s, { keepStop = false } = {}) {
  const all = norm(s).split(' ').filter(Boolean).map((t) => ORD[t] ?? t);
  const kept = all.filter((t) => keepStop || !STOP.has(t));
  // "Letters (selected)" is all filler: match on its own words rather than on nothing.
  return kept.length || keepStop ? kept : all.filter((t) => t !== 'selected');
}
/** A work's name and the alternative given in brackets: "On the Mysteries (De Mysteriis)". */
export function nameVariants(name) {
  const out = [name.replace(/\s*\([^)]*\)/g, '').trim()];
  for (const m of name.matchAll(/\(([^)]+)\)/g)) out.push(m[1].trim());
  for (const v of [...out]) if (ALIASES[norm(v)]) out.push(ALIASES[norm(v)]);
  // "Letter 22 to Eustochium" is New Advent's "Letter 22".
  const numbered = /\b(letter|epistle|oration|homily)\s+(\d+)\b/i.exec(name);
  if (numbered) out.push(`${numbered[1]} ${numbered[2]}`);
  return [...new Set(out.filter(Boolean))];
}

// The same work under another title in the catalogues, each read and confirmed by hand.
const ALIASES = {
  'against heresies': 'Adversus haereses', // New Advent's title for Irenaeus
  'exhortation to the greeks': 'Exhortation to the Heathen', // New Advent's title for Clement's Protrepticus
  'on the holy spirit': 'De Spiritu Sancto', // New Advent's title for Basil's treatise
};
/** Words that differ only by a spelling variant: proslogion/proslogium, antony/anthony. */
export function tokenEq(a, b) {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  // jovinian / jovinianus: one is the start of the other.
  if (n >= 6 && Math.abs(a.length - b.length) <= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (n < 5 || Math.abs(a.length - b.length) > 2) return false;
  const limit = n >= 9 ? 2 : 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length] <= limit;
}
const has = (set, t) => set.some((x) => tokenEq(x, t));

/** 0..1: how much of a's words are in b (ignoring filler), and the reverse, averaged. */
export function sim(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return 0;
  const ab = A.filter((t) => has(B, t)).length / A.length;
  const ba = B.filter((t) => has(A, t)).length / B.length;
  return (ab + ba) / 2;
}
export const bestSim = (workName, candidate) =>
  Math.max(...nameVariants(workName).map((v) => sim(v, candidate)));

// ── what kind of page is the current link? ─────────────────────────────────
export function addressKind(u) {
  let x; try { x = new URL(u); } catch { return 'bad'; }
  const h = x.hostname.replace(/^www\./, ''), p = x.pathname.split('/').filter(Boolean);
  if (/ccel\.org$/.test(h) && p[0] === 'ccel' && p.length <= 2) return 'author';
  if (/wikisource\.org$/.test(h) && /\/Author:/.test(x.pathname)) return 'author';
  if (/ccel\.org$/.test(h) && /^(anf|npnf)\d*/i.test(p[2] ?? '') && !/\.\w+\.\w+/.test(p[2])) return 'volume';
  if (/ccel\.org$/.test(h) && p[2] === 'anf-series') return 'volume';
  return 'unknown';
}

const lower = (s) => s.toLowerCase();

// ── New Advent: the Church Fathers catalogue ───────────────────────────────
export async function newAdventCatalogue() {
  const res = await fetchText('https://www.newadvent.org/fathers/');
  const html = res.body;
  const authors = [];
  for (const block of html.split(/<p><a href="\.\.\/cathen\/[^"]+"><strong>/).slice(1)) {
    const name = strip(block.slice(0, block.indexOf('</strong>')));
    const works = [...block.matchAll(/<a href="\.\.\/fathers\/(\d+[a-z]?)\.htm">([^<]+)<\/a>/g)]
      .map((m) => ({ title: strip(m[2]), url: `https://www.newadvent.org/fathers/${m[1]}.htm` }));
    if (works.length) authors.push({ name, works });
  }
  return authors;
}

/** A collection page (Cyprian's Treatises) links its parts as ../fathers/050703.htm: add them to the catalogue. */
export async function expandNewAdvent(catalogue, wanted) {
  for (const a of catalogue.filter((x) => wanted(x.name))) {
    const extra = [];
    for (const w of a.works) {
      const id = /fathers\/(\d+[a-z]?)\.htm/.exec(w.url)?.[1];
      if (!id) continue;
      const res = await fetchText(w.url);
      if (res.status !== 200) continue;
      const seen = new Set();
      for (const m of res.body.matchAll(new RegExp(`<a href="(?:\\.\\./fathers/|)(${id}\\d{2,3}[a-z]?)\\.htm"[^>]*>(?:<[^>]+>)*([^<]{3,120})`, 'g'))) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        let title = strip(m[2]);
        // "Treatise III" says nothing: the part's own page has the title ("On the Lapsed").
        if (/^treatise\b/i.test(title)) {
          const sub = await fetchText(`https://www.newadvent.org/fathers/${m[1]}.htm`);
          // The title is the first bold paragraph under the heading ("Treatise 3" / "On the Lapsed.").
          const after = sub.status === 200 ? sub.body.slice(sub.body.indexOf('</h1>')) : '';
          const t = strip(/<p><strong>([^<]{3,100})<\/strong><\/p>/.exec(after)?.[1] ?? '').replace(/\.$/, '');
          // Just the title, so "On the Unity of the Church" is matched as itself, not as "Treatise I: On the Unity…".
          if (t) title = t;
        }
        extra.push({ title, url: `https://www.newadvent.org/fathers/${m[1]}.htm`, part: w.title });
      }
    }
    a.works.push(...extra);
  }
  return catalogue;
}

const FIRST = (s) => tokens(s.replace(/\(.*?\)/g, ''), { keepStop: true }).filter((t) => !['saint', 'st', 'pope', 'of', 'the', 'bishop'].includes(t))[0];

/** Candidate New Advent pages for one work of one figure. */
export function newAdventCandidates(person, work, catalogue) {
  const out = [];
  const pFirst = FIRST(person.name);
  for (const a of catalogue) {
    const sameAuthor = pFirst && FIRST(a.name) === pFirst;
    for (const w of a.works) {
      const s = bestSim(work.name, w.title);
      if (s >= 0.74 && (sameAuthor || s >= 0.99)) out.push({ url: w.url, via: `New Advent: ${a.name}, "${w.title}"`, score: s + (sameAuthor ? 0.2 : 0) });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

// ── fixing the matching: authors ────────────────────────────────────────────
const TITLE_WORDS = new Set(['saint', 'st', 'pope', 'the', 'of', 'bishop', 'venerable', 'sir', 'blessed']);
const COMMON_NAMES = new Set(['john', 'peter', 'paul', 'thomas', 'gregory', 'francis', 'george', 'charles', 'william', 'nicholas', 'cyril', 'dionysius', 'clement', 'leo', 'alexander', 'anselm', 'basil', 'hilary', 'julian', 'isidore', 'cornelius', 'stephen', 'martin', 'ignatius', 'eusebius', 'theodore', 'robert', 'jan', 'james']);
const authorTokens = (s) => tokens(s.replace(/\(.*?\)/g, ''), { keepStop: true }).filter((t) => !TITLE_WORDS.has(t) && !/^\d+$/.test(t));
/** Is this New Advent author (or CCEL / Wikisource author) our figure? */
export function sameAuthor(personName, otherName) {
  const A = authorTokens(personName), B = authorTokens(otherName);
  if (!A.length || !B.length) return false;
  const [short, long] = A.length <= B.length ? [A, B] : [B, A];
  // "John" is not "John Chrysostom", but "Ambrose" is "Ambrose of Milan".
  if (short.length === 1 && long.length > 1 && COMMON_NAMES.has(short[0])) return false;
  return short.every((t) => has(long, t));
}

/** All of the work's words are in the page title, which adds at most two of its own: "Hexaemeron" in "Nine Homilies of Hexaemeron". */
export function contained(workName, pageTitle) {
  const B = tokens(pageTitle);
  let best = 0;
  for (const v of nameVariants(workName)) {
    const A = tokens(v);
    if (A.length && A.every((t) => has(B, t)) && B.length - A.length <= 2) best = Math.max(best, 0.85);
  }
  return best;
}

export function newAdventCandidates2(person, work, catalogue) {
  const out = [];
  for (const a of catalogue) {
    if (!sameAuthor(person.name, a.name)) continue;
    for (const w of a.works) {
      const s = Math.max(bestSim(work.name, w.title), contained(work.name, w.title));
      if (s >= 0.74) out.push({ url: w.url, via: `New Advent, ${a.name}: "${w.title}"${w.part ? ` (in ${w.part})` : ''}`, score: s, host: 'newadvent' });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

// ── verifying a page: does its own title name the work? ────────────────────
const SITE_BITS = /\s*[-–—|:]\s*(christian classics ethereal library|wikisource|wikipedia|britannica|bible gateway|new advent|the free encyclopedia|stanford encyclopedia of philosophy)\b.*$/i;
const cleanTitle = (t) => t.replace(/^church fathers:\s*/i, '').replace(/^(work info|author info):\s*/i, '').replace(SITE_BITS, '').trim();

/**
 * How well a page title names a work by containing its words: 0 to 0.9.
 * A title may carry a few extra words, but not so many that it is a different thing:
 * "On Truth" is not "Truth and Reconciliation". A title that lists several works
 * ("Proslogium; Monologium; ...; and Cur Deus Homo") is a book of them and is allowed.
 */
export function containScore(workName, pageTitle) {
  const B = tokens(pageTitle);
  const listed = (pageTitle.match(/[;,]/g) ?? []).length >= 2;
  let best = 0;
  for (const v of nameVariants(workName)) {
    const A = tokens(v);
    if (!A.length || !A.every((t) => has(B, t))) continue;
    const extras = Math.max(0, B.length - A.length);
    best = Math.max(best, listed || extras <= (A.length >= 2 ? 1 : 0) ? 0.9 : 0.7);
  }
  return best;
}

/** Fetch a page and score how well its title names the work: 0..1 and the title seen. */
export async function judgePage(url, work) {
  const res = await fetchText(url);
  if (res.status !== 200) return { ok: false, status: res.status, error: res.error, score: 0, title: '' };
  const titles = pageTitles(res.body).map(cleanTitle);
  let best = { score: 0, title: titles[0] ?? '' };
  for (const t of titles) {
    const s = Math.max(bestSim(work.name, t), containScore(work.name, t));
    if (s > best.score) best = { score: s, title: t };
  }
  return { ok: true, status: res.status, finalUrl: res.finalUrl, ...best };
}

// ── CCEL: an author's books, and each book's own title ─────────────────────
export async function ccelBooks(authorUrl) {
  const m = /ccel\.org\/ccel\/([^/?#]+)/.exec(authorUrl);
  if (!m) return [];
  const res = await fetchText(`https://ccel.org/ccel/${m[1]}`);
  if (res.status !== 200) return [];
  const urls = new Set();
  for (const x of res.body.matchAll(new RegExp(`/ccel/${m[1]}/([a-z0-9_.-]+)/\\1(?:[/"'#?]|$)`, 'gi'))) urls.add(`https://ccel.org/ccel/${m[1]}/${x[1]}`);
  const books = [];
  for (const u of urls) {
    const p = await fetchText(u);
    if (p.status !== 200) continue;
    const t = cleanTitle(pageTitles(p.body)[0] ?? '');
    if (t) books.push({ url: u, title: t });
  }
  return books;
}

// ── Wikisource and Wikipedia, read as ordinary pages ────────────────────────
// (Wikimedia's API answers 429 to a script on shared addresses; its pages do not.)
const wikiHref = (host, href) => `https://${host}${href}`;

/** The works linked from a Wikisource author page. */
export async function wikisourceWorks(authorUrl) {
  const m = /https?:\/\/([a-z]+\.wikisource\.org)\/wiki\/Author:/.exec(authorUrl);
  if (!m) return [];
  const res = await fetchText(authorUrl);
  if (res.status !== 200) return [];
  const body = res.body.slice(res.body.indexOf('mw-content-text'));
  const out = new Map();
  for (const x of body.matchAll(/<a href="(\/wiki\/[^"#?]+)"(?: class="[^"]*")? title="([^"]+)"/g)) {
    const title = decode(x[2]);
    if (/^(Author|Category|Portal|Wikisource|Special|Help|Template|File|Index|Page|Talk):/i.test(title)) continue;
    if (/encyclop|dictionary|biograph|catholic encyclopedia|britannica/i.test(title)) continue;
    out.set(x[1], { title, url: wikiHref(m[1], x[1]) });
  }
  return [...out.values()];
}

/** First paragraphs of a Wikipedia article, as plain text, and its heading. */
export async function wikipediaArticle(url) {
  const res = await fetchText(url);
  if (res.status !== 200) return null;
  const title = strip(/<h1[^>]*id="firstHeading"[^>]*>([\s\S]*?)<\/h1>/.exec(res.body)?.[1] ?? '');
  const intro = [...res.body.slice(res.body.indexOf('mw-content-text')).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => strip(m[1])).filter((t) => t.length > 40).slice(0, 3).join(' ');
  return { title, intro: intro.slice(0, 1800), finalUrl: res.finalUrl };
}

const WORK_WORDS = /\b(treatise|book|work|letters?|epistles?|poems?|poetry|text|commentary|dialogues?|hymns?|homil(?:y|ies)|confession|rule|sermons?|apology|chronicle|history|catechism|theses|prayers?|canons?|creed|autobiograph\w*|novel|allegory|manuscript|writings?|essay|tract|oration|discourses?|gospel|opus|summa|meditations?|revelations?|testament|poem|encyclical|decree|declaration|definition|argument|dialogue|sentences|etymolog\w*)\b/i;

/** Articles about this work (not the idea it is named after, not a person who shares a word with it). */
export async function wikipediaAbout(work, person) {
  const all = authorTokens(person.name).filter((t) => t.length > 2);
  const authorWords = all.filter((t) => !COMMON_NAMES.has(t)).length ? all.filter((t) => !COMMON_NAMES.has(t)) : all;
  const out = new Map();
  // First the work's own name as an article title: a search can rank a person above it ("Leo Tomé" for "Tome of Leo").
  for (const v of nameVariants(work.name).slice(0, 2)) {
    for (const t of [v, `${v} (${authorWords[0] ?? ''})`]) {
      const art = await wikipediaArticle(`https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`);
      if (!art || /may refer to|disambiguation/i.test(art.intro.slice(0, 300))) continue;
      const opening = norm(`${art.title} ${art.intro.slice(0, 700)}`).split(' ');
      const named = authorWords.some((w) => opening.some((x) => tokenEq(x, w)));
      if (named && WORK_WORDS.test(art.intro.slice(0, 700))) out.set(art.finalUrl, { url: art.finalUrl, via: `Wikipedia: "${art.title}"`, score: 1, host: 'wikipedia' });
    }
  }
  for (const v of nameVariants(work.name).slice(0, 2)) {
    const q = encodeURIComponent(`${v} ${authorWords[0] ?? ''}`.trim());
    const res = await fetchText(`https://en.wikipedia.org/wiki/Special:Search?search=${q}&fulltext=1&ns0=1`);
    if (res.status !== 200) continue;
    const hits = [...res.body.matchAll(/<a href="(\/wiki\/[^"#?]+)" title="([^"]+)"[^>]*data-serp-pos/g)].slice(0, 5).map((m) => [m[1], decode(m[2])]);
    // A search that lands exactly on one article redirects there.
    const landed = /\/wiki\/(?!Special:)/.test(res.finalUrl) ? [[`/wiki/${res.finalUrl.split('/wiki/')[1]}`, decodeURIComponent(res.finalUrl.split('/wiki/')[1]).replace(/_/g, ' ')]] : [];
    for (const [href, title] of [...landed, ...hits]) {
      const bare = title.replace(/\s*\([^)]*\)\s*/g, ' ');
      // Compared with filler words kept, so "Jovinian" is not "Against Jovinian".
      const s = Math.max(...nameVariants(work.name).map((n) => {
        const A = tokens(n, { keepStop: true }), B = tokens(bare, { keepStop: true });
        return A.length && B.length ? (A.filter((t) => has(B, t)).length / A.length + B.filter((t) => has(A, t)).length / B.length) / 2 : 0;
      }));
      if (s < 0.8) continue;
      const url = wikiHref('en.wikipedia.org', href);
      const art = await wikipediaArticle(url);
      if (!art) continue;
      const opening = norm(`${art.title} ${art.intro.slice(0, 700)}`).split(' ');
      const named = authorWords.some((w) => opening.some((t) => tokenEq(t, w)));
      const aWork = WORK_WORDS.test(art.intro.slice(0, 700));
      if (named && aWork) out.set(url, { url, via: `Wikipedia: "${art.title}"`, score: s, host: 'wikipedia' });
    }
  }
  return [...out.values()].sort((a, b) => b.score - a.score);
}

// ── the audit ──────────────────────────────────────────────────────────────
const GROUP_NAME = /\b(selected|collected|collections?|miscellaneous)\b|^(letters?|poems?|hymns?|sermons?|homilies|epistles?)\b[^a-z]*$/i;
const RANK = { newadvent: 0, ccel: 1, wikisource: 2, other: 3, wikipedia: 4 };

const SQL_Q = (v) => `'${String(v).replace(/'/g, "''")}'`;

export const isGone = (status) => status >= 400 && status < 500 && ![403, 429, 408, 451].includes(status);

async function judgeCurrent(url, work) {
  const j = await judgePage(url, work);
  const kind = addressKind(url);
  let cls;
  // Only a real "gone" (404, 410) is dead; a timeout, a refusal or a server error just means we could not read it.
  if (!j.ok) cls = isGone(j.status) ? 'dead' : 'blocked';
  else if (j.score >= 0.6 && kind === 'unknown') cls = 'work';
  else if (j.score >= 0.75 && kind === 'volume') cls = 'work'; // a book whose own title names the work
  else if (kind === 'author' || kind === 'volume') cls = kind;
  else cls = j.score >= 0.6 ? 'work' : 'other';
  return { ...j, cls, url };
}

async function propose(person, work, ctx) {
  const cands = [];
  for (const c of newAdventCandidates2(person, work, ctx.catalogue).slice(0, 2)) cands.push({ ...c, rank: RANK.newadvent, full: true });

  const ccelAuthor = ctx.authorUrls.get(person.person_id)?.find((u) => /ccel\.org\/ccel\/[^/]+\/?$/.test(u));
  if (ccelAuthor) for (const b of (await ctx.ccel(ccelAuthor))) {
    const s = bestSim(work.name, b.title);
    if (s >= 0.5) cands.push({ url: b.url, via: `CCEL book: "${b.title}"`, score: s, rank: RANK.ccel, full: true });
  }
  const wsAuthor = ctx.authorUrls.get(person.person_id)?.find((u) => /wikisource\.org\/wiki\/Author:/.test(u));
  if (wsAuthor) for (const b of (await ctx.wikisource(wsAuthor))) {
    const s = bestSim(work.name, b.title);
    if (s >= 0.74) cands.push({ url: b.url, via: `Wikisource: "${b.title}"`, score: s, rank: RANK.wikisource, full: true });
  }
  // Full texts first; reach for an article about the work only when none checks out.
  const judge = async (list) => {
    const out = [];
    for (const c of list.slice(0, 5)) {
      const j = await judgePage(c.url, work);
      if (j.ok) out.push({ ...c, seen: j.title, verified: j.score, finalUrl: j.finalUrl });
    }
    return out;
  };
  // An English edition before an Italian or Latin one (CCEL's "comedy-it").
  const foreign = (c) => /-(it|la|lat|el|grc|de|fr|es)$/i.test(new URL(c.url).pathname);
  const rank = (a, b) => (b.verified >= 0.8) - (a.verified >= 0.8) || foreign(a) - foreign(b) || a.rank - b.rank || b.verified - a.verified;
  const judged = (await judge(cands)).sort(rank);
  if (judged[0]?.verified >= 0.8) return judged;
  const about = (await wikipediaAbout(work, person)).slice(0, 2).map((c) => ({ ...c, rank: RANK.wikipedia, full: false }));
  return [...judged, ...(await judge(about))].sort(rank);
}

// Hosts that carry the text of a work: a link already there is not traded for an article about it.
const FULL_TEXT = /newadvent\.org\/fathers|ccel\.org\/ccel\/[^/]+\/[^/]+|wikisource\.org\/wiki\/(?!Author:)|gutenberg\.org|archive\.org\/details|perseus|sourcebooks\.fordham|biblegateway\.com|biblehub\.com|blueletterbible\.org/;
// Pages about a work, not the work: swapping one article for a better one is fine. Shops are not the work either.
const ABOUT_OR_SHOP = /wikipedia\.org|britannica\.com|plato\.stanford\.edu|newadvent\.org\/cathen|booksamillion|barnesandnoble|penguinrandomhouse|amazon\.|worldcat|ecampus|abebooks|bookshop/;

function decide(work, current, judged) {
  if (current.cls === 'work') return { action: 'keep', why: 'the page names the work' };
  // (A blocked page, such as archive.org to a script, cannot be read: it is not replaced either.)
  if ((current.ok || current.cls === 'blocked') && ['other', 'blocked'].includes(current.cls) && FULL_TEXT.test(current.url) && !judged[0]?.full) {
    return { action: 'keep', why: `already a text of the work (${new URL(current.url).hostname}); an article about it would be a step down` };
  }
  const top = judged[0];
  // The current page loads but we could not tell what it is (a scan, a manuscript page, a catalogue): the owner decides, since an article would be a step down if it is the work.
  if (['other', 'blocked'].includes(current.cls) && !ABOUT_OR_SHOP.test(current.url ?? '') && top && !top.full) {
    return { action: 'review', confidence: 'doubtful', candidates: judged.slice(0, 3), why: 'the current page loads but I could not confirm it is not the work; the only candidate is an article about it' };
  }
  const group = GROUP_NAME.test(work.name) || tokens(work.name).length === 0;
  if (top && top.verified >= 0.8 && (!group || top.full)) {
    return { action: 'change', confidence: top.full ? 'sure' : 'sure-about', to: top, why: `${top.via}; page title: "${top.seen}"` };
  }
  return { action: 'review', confidence: 'doubtful', candidates: judged.slice(0, 3), why: group ? 'a group of works' : top ? `best match "${top.seen}" scored ${top.verified.toFixed(2)}` : 'nothing found' };
}

// Sources whose links were broken, each replacement fetched and read on 2026-10-12.
const SOURCE_FIXES = {
  'src-calvin-farel-ligonier': { url: 'https://en.wikipedia.org/wiki/William_Farel', source: 'Wikipedia', why: 'the Ligonier page is gone (404); the Wikipedia article on Farel tells of Calvin at Geneva' },
  'src-ccel-perpetua': { url: 'https://www.newadvent.org/fathers/0324.htm', source: 'New Advent (Church Fathers)', why: 'the CCEL file is gone (404); New Advent has the Passion of Perpetua and Felicitas, with Saturus\'s vision' },
  'src-moerbeke-pims': { url: 'https://en.wikipedia.org/wiki/William_of_Moerbeke', source: 'Wikipedia', why: 'the PIMS PDF is gone (404); the Wikipedia article covers his translations of Aristotle' },
  'src-possidius-vita': { url: 'https://www.tertullian.org/fathers/possidius_life_of_augustine_02_text.htm', source: 'Tertullian.org', why: 'the old address is gone (404); this is the same site\'s English text of the Life' },
  'src-teresa-john-cross-aleteia': { url: 'https://en.wikipedia.org/wiki/John_of_the_Cross', source: 'Wikipedia', why: 'the Aleteia article is gone (404); the Wikipedia article on John of the Cross covers his work with Teresa' },
  'src-wikipedia-bradford': { url: 'https://en.wikipedia.org/wiki/William_Bradford_(governor)', source: 'Wikipedia', why: 'the article was renamed; the old title is a 404' },
  'src-eusebius-papias': { url: 'https://www.newadvent.org/fathers/250103.htm', source: 'New Advent (Church Fathers)', why: 'the CatholicLibrary viewer shows an error; Church History III.39 on Papias is in Book III here' },
};
// Sources whose page title wording differs from ours, read and found to be the right page.
const SOURCE_OK = {
  'src-basil-de-spiritu-sancto': 'New Advent titles Basil\'s treatise "De Spiritu Sancto"',
  'src-gregory-naz-ep-101': 'the page is Gregory\'s letters, including Letter 101',
  'src-ignatius-to-polycarp': 'the page is the Ignatius epistles, including the one to Polycarp',
  'src-leo-tome': 'the page is Letter 28, "The Tome"',
  'src-newadvent-chalcedon': 'the page is the Council of Chalcedon: definition and canons',
  'src-newadvent-constantinople-1': 'the page is the First Council of Constantinople (382): canons',
  'src-newadvent-council-ephesus': 'the page is the Council of Ephesus: documents',
  'src-newadvent-nicaea-canons': 'the page is the First Council of Nicaea: canons and creed',
  'src-eusebius-eh-v-20': 'chapter 20 is in Book V of the Church History, which this page is',
  'src-photios-oca': 'the OCA article on St Photius',
  'src-tertullian-prescription-32': 'a deep link to chapter 32 of the Prescription, in ANF vol. 3',
};

async function auditSources(snap) {
  const rows = [];
  for (const src of snap.CH_Sources) {
    const j = await judgeSource(src);
    const fix = SOURCE_FIXES[src.source_id];
    const base = { table: 'CH_Sources', id: src.source_id, person: 'Sources', name: src.title, current: { url: src.url, cls: j.cls, title: j.seen } };
    if (fix && src.url === fix.url) {
      rows.push({ ...base, action: 'keep', why: 'already points at the replacement' });
    } else if (fix) {
      const t = await fetchText(fix.url);
      if (t.status !== 200) throw new Error(`replacement for ${src.source_id} is not reachable: ${t.status}`);
      rows.push({ ...base, action: 'change', confidence: 'sure', to: { url: fix.url, finalUrl: fix.url, source: fix.source }, why: fix.why });
    } else if (['ok', 'ok-slug', 'ok-blocked'].includes(j.cls) || SOURCE_OK[src.source_id]) {
      rows.push({ ...base, action: 'keep', why: SOURCE_OK[src.source_id] ?? `the page names "${j.subject}"` });
    } else {
      rows.push({ ...base, action: 'review', why: `page ${j.status}: "${j.seen}"`, candidates: [] });
    }
  }
  return rows;
}

async function main() {
  const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/e2e/data/lifelines-snapshot.json'), 'utf8'));
  const people = new Map(snap.CH_People.map((p) => [p.person_id, p]));
  const works = snap.CH_Works.filter((w) => people.has(w.person_id) && (!ONLY || ONLY.includes(w.person_id)));

  // Author pages linked from any of a figure's works tell us where to look.
  const authorUrls = new Map();
  for (const w of snap.CH_Works) {
    if (addressKind(w.text_url ?? '') !== 'author') continue;
    (authorUrls.get(w.person_id) ?? authorUrls.set(w.person_id, []).get(w.person_id)).push(w.text_url);
  }
  const memo = (fn) => { const m = new Map(); return (k) => m.get(k) ?? m.set(k, fn(k)).get(k); };
  const ctx = {
    catalogue: await expandNewAdvent(await newAdventCatalogue(), (name) => [...people.values()].some((p) => sameAuthor(p.name, name))), authorUrls,
    ccel: memo(ccelBooks), wikisource: memo(wikisourceWorks), quick: args.includes('--quick'),
  };

  const rows = [];
  for (const [i, w] of works.entries()) {
    const person = people.get(w.person_id);
    const current = await judgeCurrent(w.text_url, w);
    const decision = decide(w, current, current.cls === 'work' ? [] : await propose(person, w, ctx));
    rows.push({ table: 'CH_Works', id: w.work_id, person: person.name, name: w.name, current: { url: w.text_url, ...current }, ...decision });
    if ((i + 1) % 20 === 0) console.error(`${i + 1}/${works.length}`);
  }
  if (!ONLY) rows.push(...await auditSources(snap));
  guardDuplicates(rows);
  writeReport(rows);
}

// Matches read and found to be about something else, so they go to Matthew instead.
const NOT_THESE = {
  'CH_Works:Theological Orations (Orations 27–31)': 'the page found is only the first of the five Theological Orations (27); the set is in Select Orations',
  'CH_Works:Sentences (Sententiae)': 'Wikipedia\'s "Sentences" is about the medieval genre (Peter Lombard), not Isidore\'s book',
};

/** One article cannot be the answer for two different people's works. */
function guardDuplicates(rows) {
  const owners = new Map();
  for (const r of rows.filter((x) => x.action === 'change' && x.table === 'CH_Works')) {
    (owners.get(r.to.url) ?? owners.set(r.to.url, new Set()).get(r.to.url)).add(r.person);
  }
  for (const r of rows.filter((x) => x.action === 'change')) {
    const reason = NOT_THESE[`${r.table}:${r.name}`] ?? (owners.get(r.to.url)?.size > 1 ? `the same page was found for ${[...owners.get(r.to.url)].join(' and ')}` : null);
    if (reason) Object.assign(r, { action: 'review', confidence: 'doubtful', candidates: [{ ...r.to, seen: r.to.seen ?? '', verified: r.to.verified ?? 0 }], why: reason, to: undefined });
  }
}

function writeReport(rows) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(rows, null, 1));
  const count = (f) => rows.filter(f).length;
  const lines = [`# Works & Sources link audit`, '',
    `${rows.length} links: ${count((r) => r.action === 'keep')} already point at the work, ${count((r) => r.action === 'change')} to change, ${count((r) => r.action === 'review')} for review.`, ''];
  for (const act of ['change', 'review', 'keep']) {
    lines.push(`## ${act}`, '');
    let last = '';
    for (const r of rows.filter((x) => x.action === act)) {
      if (r.person !== last) { lines.push(`### ${r.person}`); last = r.person; }
      lines.push(`- **${r.name}** (${r.table} ${r.id}) — now: ${r.current.url} [${r.current.cls}; "${r.current.title ?? ''}"]`);
      if (r.to) lines.push(`  - ➜ ${r.to.url} (${r.confidence}) ${r.why}`);
      else if (r.candidates?.length) for (const c of r.candidates) lines.push(`  - ? ${c.url} ${c.via}; page title "${c.seen}" (${c.verified.toFixed(2)})`);
      if (act === 'review') lines.push(`  - ${r.why}`);
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n'));
  if (args.includes('--sql')) {
    const sql = rows.filter((r) => r.action === 'change').map((r) => {
      const works = r.table === 'CH_Works';
      const set = works ? `text_url = ${SQL_Q(r.to.url)}` : `url = ${SQL_Q(r.to.url)}${r.to.source ? `, source_name = ${SQL_Q(r.to.source)}` : ''}`;
      const key = works ? `work_id = ${r.id}` : `source_id = ${SQL_Q(r.id)}`;
      const was = works ? `text_url = ${SQL_Q(r.current.url)}` : `url = ${SQL_Q(r.current.url)}`;
      return `update public."${r.table}" set ${set} where ${key} and ${was}; -- ${r.person}: ${r.name.replace(/\s+/g, ' ')}`;
    });
    fs.writeFileSync(path.join(OUT, 'changes.sql'), sql.join('\n') + '\n');
  }
  console.log(lines.slice(0, 3).join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

// ── Sources ────────────────────────────────────────────────────────────────
/** What a source is about: the part after a dash if there is one ("Athanasius – De Decretis"), else its title, minus bracketed notes. */
export function sourceSubject(title) {
  const afterDash = title.split(/\s+[–—-]\s+/);
  const main = (afterDash.length > 1 ? afterDash.slice(1).join(' ') : title).replace(/\s*\([^)]*\)/g, '').trim();
  return main || title;
}

export async function judgeSource(src) {
  const subject = sourceSubject(src.title);
  const fake = { name: subject };
  const j = await judgePage(src.url, fake);
  const slug = decodeURIComponent(new URL(src.url).pathname).replace(/[/_.-]+/g, ' ');
  const slugScore = Math.max(...nameVariants(subject).map((v) => {
    const A = tokens(v); const S = tokens(slug);
    return A.length ? A.filter((t) => has(S, t)).length / A.length : 0;
  }));
  let cls;
  if (!j.ok) cls = !isGone(j.status) ? (slugScore >= 0.6 ? 'ok-blocked' : 'blocked') : 'dead';
  else if (j.score >= 0.6) cls = 'ok';
  else if (slugScore >= 0.6) cls = 'ok-slug';
  else cls = addressKind(src.url) === 'volume' ? 'volume' : 'mismatch';
  return { subject, cls, status: j.status, seen: j.title, score: j.score, slugScore };
}
