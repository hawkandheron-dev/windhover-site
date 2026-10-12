import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { addressKind } from '../../scripts/check-work-links.mjs';

// The Works & Sources link fix (2026-10-12): the migration and the snapshot the
// e2e tests and shots replay must say the same thing, and the fix must never
// point a work back at its author's page.
const snapshot = JSON.parse(fs.readFileSync('tests/e2e/data/lifelines-snapshot.json', 'utf8'));
const migration = fs.readFileSync('supabase/migrations/20261012120000_ch_work_source_links.sql', 'utf8');

const updates = migration.split('\n').filter((l) => l.startsWith('update')).map((l) => {
  const m = /^update public\."(CH_Works|CH_Sources)" set (?:text_url|url) = '([^']*)'(?:, source_name = '([^']*)')? where (?:work_id|source_id) = (\S+) and (?:text_url|url) = '([^']*)';/.exec(l);
  if (!m) throw new Error(`unparsed statement: ${l.slice(0, 90)}`);
  const [, table, to, sourceName, id, from] = m;
  return { table, to, sourceName, id: id.replace(/'/g, ''), from };
});

const rowFor = ({ table, id }) => snapshot[table].find((r) => String(r.work_id ?? r.source_id) === id);

describe('Works & Sources link fix', () => {
  it('has the statements the audit proposed', () => {
    expect(updates.length).toBeGreaterThan(100);
  });

  it('changes every link it touches, to a real address', () => {
    for (const u of updates) {
      expect(u.to, u.id).not.toBe(u.from);
      expect(u.to, u.id).toMatch(/^https:\/\//);
    }
  });

  it('never points a work at an author page or a whole volume', () => {
    for (const u of updates) expect(addressKind(u.to), `${u.table} ${u.id}`).toBe('unknown');
  });

  it('leaves the snapshot saying what the migration says', () => {
    for (const u of updates) {
      const row = rowFor(u);
      expect(row, `${u.table} ${u.id}`).toBeTruthy();
      expect(row.text_url ?? row.url, `${u.table} ${u.id}`).toBe(u.to);
      if (u.sourceName) expect(row.source_name).toBe(u.sourceName);
    }
  });

  it('fixes each row once', () => {
    const keys = updates.map((u) => `${u.table}:${u.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
