import { Icon } from './Icon.jsx';
import { StringMark } from './StringMark.jsx';

/**
 * The coloured band naming an entry's kind (config.detailTypeBand), led by
 * that kind's mark in white: the Key's diamond, square or dot, the crown, a
 * figure's bar or a year's line.
 */
export function DetailTypeBand({ band }) {
  let mark = null;
  if (band.mark === 'crown') mark = <Icon name="crown" size={15} color="#fff" />;
  else if (band.mark === 'bar' || band.mark === 'line') mark = <span className={`modal-type-band-${band.mark}`} />;
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
