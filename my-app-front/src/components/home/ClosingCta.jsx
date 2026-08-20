import { text } from '../../constants';
import useReveal from '../../utils/useReveal';

export default function ClosingCta({ onOpenMap, onMoveParty }) {
  const ref = useReveal();

  return (
    <section className="closingCta reveal" aria-labelledby="closing-title" ref={ref}>
      <div className="revealItem">
        <h2 id="closing-title">{text.closingTitle}</h2>
        <p>{text.closingSub}</p>
        <div className="closingActions">
          <button className="closingPrimary" type="button" onClick={onOpenMap}>{text.closingMap}</button>
          <button className="closingGhost" type="button" onClick={onMoveParty}>{text.closingParty}</button>
        </div>
      </div>
    </section>
  );
}
