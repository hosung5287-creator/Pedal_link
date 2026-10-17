import '../styles/pagination.css';

// 페이지 번호 버튼 — 번호는 한 번에 group 개씩 보인다 (1~5 → 6~10 …).
// [이전]/[다음] 은 한 페이지씩 움직이고, 묶음 경계를 넘으면 번호 묶음도 같이 바뀐다.
// 페이지가 1개뿐이면 아무것도 그리지 않는다.
export default function Pagination({ page, totalPages, onChange, label = '페이지 이동', group = 5 }) {
  if (totalPages <= 1) return null;

  const first = Math.floor((page - 1) / group) * group + 1;
  const last = Math.min(first + group - 1, totalPages);
  const numbers = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  return (
    <nav className="pager" aria-label={label}>
      <button
        type="button"
        className="pagerBtn pagerStep"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="이전 페이지"
      >
        ‹<span className="pagerStepText"> 이전</span>
      </button>
      <ol className="pagerList">
        {numbers.map((n) => (
          <li key={n}>
            <button
              type="button"
              className={`pagerBtn${n === page ? ' isCurrent' : ''}`}
              onClick={() => onChange(n)}
              aria-current={n === page ? 'page' : undefined}
              aria-label={`${n}페이지`}
            >
              {n}
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="pagerBtn pagerStep"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="다음 페이지"
      >
        <span className="pagerStepText">다음 </span>›
      </button>
    </nav>
  );
}
