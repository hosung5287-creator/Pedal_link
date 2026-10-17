import '../styles/userprofile.css';

import { useEffect, useRef, useState } from 'react';
import { userProfile as t } from '../constants';
import { getPublicProfile } from '../api/users';
import { getRideStats } from '../api/rides';
import BikeLinks from './BikeLinks';
import { fmt1 } from '../utils/format';

const GENDER_LABEL = { male: '남성', female: '여성' };

function joinedText(createdAt) {
  const d = createdAt ? new Date(createdAt) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return t.joined(d.getFullYear(), d.getMonth() + 1);
}

// 다른 라이더의 공개 프로필 창 — 기본 정보 + 라이딩 통계.
// 피드 작성자를 눌렀을 때 띄우고, 나중에 파티 도크 멤버 카드·지도 핀에서도 같은 창을 쓸 수 있다.
// userId 로 공개 프로필(이메일 없음)과 통계를 불러오고, name 은 불러오는 동안 먼저 보여줄 이름이다.
// badges: 이름 옆에 붙일 추가 표시 (예: 파티 도크에서 연 호스트 → ['호스트'])
export default function UserProfileModal({ userId, name, isMe = false, badges = [], onClose }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'failed'
  const closeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    // 통계는 없어도 프로필은 보여줄 수 있어서 따로 실패 처리한다
    Promise.all([getPublicProfile(userId), getRideStats(userId).catch(() => null)])
      .then(([p, s]) => {
        if (!alive) return;
        setProfile(p);
        setStats(s);
        setStatus('ready');
      })
      .catch(() => { if (alive) setStatus('failed'); });
    return () => { alive = false; };
  }, [userId]);

  // ESC 로 닫기 + 열리면 닫기 버튼에 포커스, 닫히면 원래 누른 곳으로 포커스를 돌려준다.
  // onClose 는 부모가 매번 새로 만들 수 있어 ref 로 받는다 — 의존성에 넣으면 렌더마다 포커스가 튄다.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  const shownName = profile?.name || name || '?';
  const letter = shownName.trim().charAt(0);

  return (
    <div className="upBackdrop" onClick={onClose} role="presentation">
      <div
        className="upModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="up-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" ref={closeRef} className="upClose" onClick={onClose} aria-label={t.close}>×</button>

        <header className="upHead">
          <span className="upAvatar" aria-hidden="true">{letter}</span>
          <div className="upHeadText">
            <h2 id="up-title">
              {shownName}
              {isMe && <span className="upMeBadge">{t.me}</span>}
              {badges.map((b) => <span key={b} className="upMeBadge">{b}</span>)}
            </h2>
            {profile && joinedText(profile.createdAt) && <p className="upJoined">{joinedText(profile.createdAt)}</p>}
          </div>
        </header>

        {status === 'loading' && <p className="upHint">{t.loading}</p>}
        {status === 'failed' && <p className="upHint">{t.failed}</p>}

        {status === 'ready' && (
          <>
            {profile.bio && <p className="upBio">{profile.bio}</p>}

            <section className="upSection">
              <h3>{t.infoTitle}</h3>
              <ul className="upInfoList">
                <li><span>{t.gender}</span><strong>{GENDER_LABEL[profile.gender] || '-'}</strong></li>
                <li><span>{t.age}</span><strong>{profile.age ?? '-'}</strong></li>
                <li><span>{t.region}</span><strong>{profile.region || '-'}</strong></li>
                <li><span>{t.bike}</span><strong><BikeLinks info={profile.bikeInfo} /></strong></li>
              </ul>
            </section>

            <section className="upSection">
              <h3>{t.statsTitle}</h3>
              <div className="upStats">
                <div className="upStat"><strong>{stats ? stats.rideCount : '-'}</strong><span>{t.rideCount}</span></div>
                <div className="upStat"><strong>{stats ? fmt1(stats.totalDistanceKm) : '-'}</strong><span>{t.distance}</span></div>
                <div className="upStat"><strong>{stats ? stats.totalAscendM : '-'}</strong><span>{t.ascend}</span></div>
                <div className="upStat"><strong>{stats?.ascendPerKm != null ? stats.ascendPerKm.toFixed(1) : '-'}</strong><span>{t.ascendPerKm}</span></div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
