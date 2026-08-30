import BrandLogo from '../BrandLogo';

// 홈 하단 푸터(S7) — 브랜드 + 태그라인 + 링크 3열 + 저작권.
// 링크는 아직 라우팅 대상이 없어 자리표시용(href="#").
export default function SiteFooter({ tagline, columns, copyright }) {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="siteFooterBrand">
          <span className="siteFooterBrandName"><BrandLogo className="brandLogo" />PedalLink</span>
          <p>{tagline}</p>
        </div>
        <div className="siteFooterCols">
          {columns.map((col) => (
            <div className="siteFooterCol" key={col.head}>
              <h4>{col.head}</h4>
              {col.items.map((it) => <a key={it} href="#">{it}</a>)}
            </div>
          ))}
        </div>
      </div>
      <p className="siteFooterCopy">{copyright}</p>
    </footer>
  );
}
