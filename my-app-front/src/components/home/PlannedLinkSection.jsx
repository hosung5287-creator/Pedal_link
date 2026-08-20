import { plannedLinks, text } from '../../constants';
import useReveal from '../../utils/useReveal';

export default function PlannedLinkSection({ onMoveParty }) {
  const ref = useReveal();

  return (
    <section className="homeSection reveal" id="planned" aria-labelledby="planned-title" ref={ref}>
      <div className="homeSectionHeader revealItem">
        <p className="homeEyebrow">{text.plannedEyebrow}</p>
        <h2 id="planned-title">{text.plannedTitle}</h2>
        <p className="homeLead">{text.plannedSub}</p>
      </div>

      <div className="homeGrid" aria-label={text.plannedAria}>
        {plannedLinks.map((link, index) => (
          <article
            className="linkCard plannedCard revealItem"
            key={link.title}
            style={{ '--delay': `${index * 60}ms` }}
          >
            <div className="linkCardTop">
              <span className="linkBadge">{text.plannedWhenLabel}</span>
              <span className="linkWhen">{link.whenLabel}</span>
            </div>
            <h3>{link.title}</h3>
            <p className="linkRoute">{link.routeName}</p>
            <p className="linkMeta">{text.plannedHostLabel} · {link.hostName}</p>
            <div className="linkFoot">
              <span className="linkMembers">
                {link.members}/{link.maxMembers}{text.partyMembers}
              </span>
              <span className="linkGauge" aria-hidden="true">
                <span style={{ width: `${(link.members / link.maxMembers) * 100}%` }} />
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="homeSectionCta revealItem" style={{ '--delay': '240ms' }}>
        <button className="appButton" type="button" onClick={onMoveParty}>{text.plannedCta}</button>
      </div>
    </section>
  );
}
