// Canonical list of site sections that can own feedback in App_Issues.
// Add new apps here as they're built. The DB column is free-form text;
// this constant is the single source of truth for the picker, the
// contribution-list grouping headers, and the row badge label.
export const APP_SECTIONS = [
  { id: 'general',              label: 'General' },
  { id: 'ch-timeline',          label: 'Church History Timeline' },
  { id: 'ch-timeline-2',        label: 'Church History Timeline 2.0' },
  { id: 'heresies',             label: 'Heresies & Christological Controversies' },
  { id: 'first-century-church', label: 'First Century Church Directory' },
  { id: 'bible-atlas',          label: 'Biblical History Atlas' },
];

export const APP_SECTION_LABELS = Object.fromEntries(
  APP_SECTIONS.map(s => [s.id, s.label])
);

export function appSectionLabel(id) {
  return APP_SECTION_LABELS[id] || id || 'Unknown';
}
