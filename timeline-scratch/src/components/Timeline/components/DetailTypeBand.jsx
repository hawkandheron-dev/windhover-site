import { Icon } from './Icon.jsx';
import { StringMark } from './StringMark.jsx';

const ICON_MARKS = new Set(['crown', 'profile', 'hourglass']);

/**
 * The coloured band naming an entry's kind (config.detailTypeBand), led by
 * an icon in white: the Key's diamond, square or dot for a council, text or
 * event, the crown for a ruler, a portrait for a figure, an hourglass for a
 * year.
 */
export function DetailTypeBand({ band }) {
  let mark = null;
  if (ICON_MARKS.has(band.mark)) mark = <Icon name={band.mark} size={16} color="#fff" />;
  else if (band.mark) mark = <StringMark mark={band.mark} color="#fff" size={10} />;
  return (
    <p className="modal-type-band">
      <span className="modal-type-band-label">
        {mark && <span className="modal-type-band-mark" aria-hidden="true">{mark}</span>}
        {band.label}
      </span>
      {band.detail && <span className="modal-type-band-detail">{band.detail}</span>}
    </p>
  );
}
