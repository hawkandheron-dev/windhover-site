# Attribution

Windhover makes use of the following third-party content. Each entry lists the
source, the license that covers our use, and a link to the upstream item.
When adding new third-party assets (images, fonts, map tiles, data), please
append them here.

## Images

### Bodleian Library, MS. Bodl. 264, fol. 128r — *The Romance of Alexander*

Used as a fixed low-opacity (~7%) page background on most of the site
(`style.css`, `body::before`), and reproduced on the design system page.

- **Source:** Digital Bodleian, Bodleian Libraries, University of Oxford.
- **Permalink:** https://digital.bodleian.ox.ac.uk/objects/a95d5c8f-9ba0-4e32-92f5-0f01840ba629/
- **License:** Terms of use as published by the Digital Bodleian — please
  confirm the current license for this item before redistributing the image
  itself.

### Bodleian Library, MS. Laud Misc. 388, fol. 16v

Present in `resources/` for future use; not currently displayed on any page.

- **Source:** Digital Bodleian, Bodleian Libraries, University of Oxford.

## Maps

### OpenHistoricalMap

Four pages load map tiles + cartographic style from OpenHistoricalMap via
MapLibre GL JS:

- `timeline-scratch/src/components/BiblicalPlaces/BiblicalPlacesMap.jsx`
- `timeline-scratch/src/components/AfricanKingdoms/AfricanKingdomsMap.jsx`
- `timeline-scratch/src/components/Timeline/components/HistoricalMap.jsx`
- `timeline-scratch/src/components/Timeline/components/YearDetailMap.jsx`

- **Data:** © OpenHistoricalMap contributors — licensed under the
  [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- **Cartography:** © OpenHistoricalMap — licensed under
  [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/).
- **Home:** https://www.openhistoricalmap.org/

Attribution is rendered at runtime by MapLibre's default
`AttributionControl` using the attribution declared in the OpenHistoricalMap
style JSON. On Lifelines that control is collapsed to an (i) button, so a
plain credit line is also printed under each map (`mapCreditLine`).

## Text

### Wikipedia

Lifelines' detail panel shows the lead summary of a figure's Wikipedia
article, fetched live from the Wikipedia REST API.

- **License:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  Each excerpt links to its article and carries a licence line beneath it
  (`wikiLicenceNote`).

## Tour pictures (Lifelines)

The tour's pictures (`CH_LinkedMedia`, `entity_type = 'tour_scene'`) are
hot-linked from Wikimedia Commons. Each is credited under the tour text with
its stored attribution and a link to its Commons file page.

- **To do (needs network access):** every row says "Public domain, Wikimedia
  Commons". Check each file's actual licence on its Commons page and correct
  the attribution where it differs (author and licence for anything CC BY or
  CC BY-SA).

## Fonts

### Outfit

Used for the Windhover wordmark.

- **Source:** https://fonts.google.com/specimen/Outfit
- **License:** SIL Open Font License 1.1 — see `resources/fonts/Outfit/OFL.txt`.

### Cormorant & Alegreya Sans

Body and display type. Lifelines serves them itself from the `@fontsource`
packages (`timeline-scratch/src/fonts-local.css`), so readers' addresses
aren't shared with Google; the other pages still load them from Google Fonts
(`fonts-google.css`).

- **License:** SIL Open Font License 1.1.

## Our content

**Lifelines** — the timeline's selection of people, dates and connections
(the `CH_*` tables) and the tour text — is licensed under
[Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/):
anyone may reuse it, with credit to Matt Brown. Most of what a reader sees
in the detail panel comes from elsewhere (Wikipedia, below); the licence
covers the work of choosing and connecting it, so others can reuse the
dataset without asking. This is stated to readers in
Lifelines' About dialog. Third-party material it shows (Wikipedia text,
maps, pictures) stays under its own licence, listed above.

The rest of the site's prose and the code are not yet published under an
explicit license and remain "all rights reserved" by default; please ask
before redistributing.
