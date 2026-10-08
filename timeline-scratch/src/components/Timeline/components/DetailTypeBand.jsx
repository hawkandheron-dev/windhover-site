/** The coloured band naming an entry's kind (config.detailTypeBand). */
export function DetailTypeBand({ band }) {
  return (
    <p className="modal-type-band">
      <span className="modal-type-band-label">{band.label}</span>
      {band.detail && <span className="modal-type-band-detail">{band.detail}</span>}
    </p>
  );
}

