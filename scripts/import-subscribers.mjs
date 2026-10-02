#!/usr/bin/env node
/**
 * Load the Substack subscriber export into the feedback gate.
 *
 * Substack has no API, so the list arrives as a CSV you download by hand
 * (Settings → Exports). Run this after each export; until you do, a brand-new
 * subscriber cannot submit feedback.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... FEEDBACK_SIGNING_SECRET=... \
 *     node scripts/import-subscribers.mjs ~/Downloads/subscribers.csv
 *
 * The two secrets are the same values set in the Cloudflare Pages project.
 * FEEDBACK_SIGNING_SECRET must match exactly, or every address will hash
 * differently from what the gate computes and nobody will get a code.
 *
 * NO PLAINTEXT ADDRESS IS SENT ANYWHERE. Each one is turned into an HMAC here,
 * on your machine, and only the digest is uploaded. This script prints counts
 * and never an address, so its output is safe to paste.
 *
 * Existing rows are left alone and unsubscribes are NOT removed — removal is a
 * separate, destructive decision. Pass --prune to delete digests that are
 * absent from the CSV, which is how someone who unsubscribed loses access.
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FEEDBACK_SIGNING_SECRET } = process.env;
const [, , csvPath, ...flags] = process.argv;
const prune = flags.includes('--prune');

if (!csvPath) die('Usage: node scripts/import-subscribers.mjs <export.csv> [--prune]');
for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FEEDBACK_SIGNING_SECRET })) {
  if (!value) die(`Missing ${name} in the environment.`);
}

function die(msg) { console.error(msg); process.exit(1); }

/** Must match normalizeEmail + hashEmail in functions/_lib/gate.js exactly. */
const normalize = (email) => String(email || '').trim().toLowerCase();
const hashEmail = (email) =>
  createHmac('sha256', `email-v1:${FEEDBACK_SIGNING_SECRET}`).update(normalize(email)).digest('hex');

/**
 * Pull addresses out of the CSV.
 *
 * Substack's column layout has changed before, so rather than trusting a
 * header name this takes any field that looks like an address — which also
 * copes with a hand-made list that is just one address per line.
 */
function extractEmails(csv) {
  const found = new Set();
  for (const line of csv.split(/\r?\n/)) {
    for (const cell of line.split(',')) {
      const value = cell.trim().replace(/^"|"$/g, '');
      if (/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value)) found.add(normalize(value));
    }
  }
  return [...found];
}

async function db(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) die(`Supabase ${init.method || 'GET'} ${path} -> ${res.status}: ${await res.text()}`);
  return res;
}

const emails = extractEmails(readFileSync(csvPath, 'utf8'));
if (emails.length === 0) die('No email addresses found in that file.');

const digests = emails.map(hashEmail);
console.log(`Found ${emails.length} addresses in the export.`);

// Upsert in batches; ignore-duplicates keeps added_at meaningful for rows that
// were already there.
const BATCH = 500;
for (let i = 0; i < digests.length; i += BATCH) {
  await db('Feedback_Subscribers', {
    method: 'POST',
    headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(digests.slice(i, i + BATCH).map(email_hmac => ({ email_hmac }))),
  });
  console.log(`  uploaded ${Math.min(i + BATCH, digests.length)} / ${digests.length}`);
}

if (prune) {
  const existing = await (await db('Feedback_Subscribers?select=email_hmac')).json();
  const keep = new Set(digests);
  const stale = existing.map(r => r.email_hmac).filter(h => !keep.has(h));
  for (const hash of stale) {
    await db(`Feedback_Subscribers?email_hmac=eq.${hash}`, { method: 'DELETE' });
  }
  console.log(`Pruned ${stale.length} addresses no longer in the export.`);
}

const total = await db('Feedback_Subscribers?select=email_hmac', { headers: { prefer: 'count=exact' } });
console.log(`Done. The gate now holds ${(await total.json()).length} subscribers.`);
