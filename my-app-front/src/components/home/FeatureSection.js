import { features, text } from '../../constants';
import useReveal from '../../utils/useReveal';

// 기능별 인라인 SVG 아이콘 (이모지 미사용 방침에 맞춤)
const ICONS = {
  match: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  route: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  ),
};

export default function FeatureSection() {
  const ref = useReveal();

  return (
    <section className="homeSection featureSection reveal" id="features" aria-labelledby="features-title" ref={ref}>
      <div className="homeSectionHeader revealItem">
        <p className="homeEyebrow">{text.featureEyebrow}</p>
        <h2 id="features-title">{text.featureTitle}</h2>
        <p className="homeLead">{text.featureLead}</p>
      </div>

      <div className="featureList" aria-label={text.featureAria}>
        {features.map((feature, index) => (
          <article
            className="featureRow revealItem"
            key={feature.key}
            style={{ '--delay': `${index * 100}ms` }}
          >
            <span className="featureIndex" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div className="featureRowMedia" aria-hidden="true">
              <span className="featureIcon">{ICONS[feature.key]}</span>
            </div>
            <div className="featureRowBody">
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
