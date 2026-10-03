/**
 * Let a page opt out of the OS dark theme with <html data-theme="light">.
 *
 * Shared component stylesheets carry `@media (prefers-color-scheme: dark)`
 * blocks for the parchment apps. Lifelines holds a light palette under a dark
 * OS (DESIGN.md §5), and a media query cannot be switched off per page, so
 * those blocks turned its buttons, legend and search dark on a white ground.
 *
 * This rewrites every selector inside a dark block from `.x` to
 * `:where(html:not([data-theme="light"])) .x`. `:where()` carries zero
 * specificity, so on every page without the attribute the cascade is exactly
 * what it was: same rules, same winners. Only a page that sets the attribute
 * loses the dark rules.
 *
 * A rule already written against `[data-theme…]` is left alone; that is how a
 * light-held page styles itself for a dark OS on purpose (see
 * ChurchHistory2App.css softening its white).
 */
const GUARD = ':where(html:not([data-theme="light"]))';

function isDarkQuery(params) {
  return /prefers-color-scheme\s*:\s*dark/.test(params);
}

export default function lightThemeOptOut() {
  return {
    postcssPlugin: 'light-theme-optout',
    Rule(rule) {
      if (rule.__lightThemeGuarded) return;
      let parent = rule.parent;
      let inDark = false;
      while (parent) {
        if (parent.type === 'atrule' && parent.name === 'media' && isDarkQuery(parent.params)) {
          inDark = true;
          break;
        }
        // Keyframes inside a dark block hold percentages, not selectors.
        if (parent.type === 'atrule' && /keyframes$/.test(parent.name)) return;
        parent = parent.parent;
      }
      if (!inDark) return;
      rule.__lightThemeGuarded = true;
      rule.selectors = rule.selectors.map(sel => {
        if (sel.includes('[data-theme')) return sel;
        // The root element can't be its own descendant; guard it in place,
        // again inside :where() so its specificity is unchanged.
        if (/^(html|:root)\b/.test(sel)) return sel.replace(/^(html|:root)/, '$1:where(:not([data-theme="light"]))');
        return `${GUARD} ${sel}`;
      });
    },
  };
}
lightThemeOptOut.postcss = true;
