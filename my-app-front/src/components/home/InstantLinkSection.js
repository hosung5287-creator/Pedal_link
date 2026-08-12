import { instantLinks, text } from '../../constants';
import useReveal from '../../utils/useReveal';

export default function InstantLinkSection({ onMoveParty }) {
  const ref = useReveal();

  return (
    <section className="homeSection reveal" id="instant" aria-labelledby="instant-title" ref={ref}>
      <div className="homeSectionHeader revealItem">
        <p className="homeEyebrow">{text.instantEyebrow}</p>
        <h2 id="instant-title">{text.instantTitle}</h2>
        <p className="homeLead">{text.instantSub}</p>
      </div>

      <div className="homeGrid" aria-label={text.instantAria}>
        {instantLinks.map((link, index) => (
          <article
            className="linkCard revealItem"
            key={link.title}
            style={{ '--delay': `${index * 60}ms` }}
          >
            <div className="linkCardTop">
              <span className="linkBadge linkBadgeLive">{link.nearbyLabel}</span>
              <span className="linkWhen">{link.leaveInLabel}</span>
            </div>
            <h3>{link.title}</h3>
            <p className="linkRoute">{link.routeName}</p>
            <p className="linkMeta">{link.startLabel}</p>
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
        <button className="appButton" type="button" onClick={onMoveParty}>{text.instantCta}</button>
      </div>
    </section>
  );
}
