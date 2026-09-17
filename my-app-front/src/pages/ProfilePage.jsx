import '../styles/account.css';

import { useEffect, useState } from 'react';
import BrandLogo from '../components/BrandLogo';
import { text, account } from '../constants';
import { getProfile, updateProfile } from '../api/users';
import { getRideStats, getRideHistory } from '../api/rides';

const GENDER_LABEL = { male: '남성', female: '여성', none: '선택 안 함' };
const EVEREST_M = 8849; // 총 상승고도를 재미로 비교할 기준

// 라이더 역량 — 각 항목을 "만렙 기준값" 대비 퍼센트로 계산한 다음,
// 그 중 제일 높은 항목을 100%(가장 긴 막대)로 놓고 나머지는 그에 비례해서 보여준다.
// (절대적인 달성률이 아니라 "이 라이더는 상대적으로 뭐가 강한지"를 보여주는 그래프)
const ABILITY_DEFS = [
  { key: 'endurance', label: '지구력', unit: 'km', max: 500, value: (s) => s.totalDistanceKm, display: (v) => v.toFixed(1) },
  { key: 'climbing', label: '등반력', unit: 'm', max: 5000, value: (s) => s.totalAscendM, display: (v) => Math.round(v).toLocaleString() },
  { key: 'speed', label: '스피드', unit: 'km/h', max: 30, value: (s) => (s.totalDurationMin > 0 ? s.totalDistanceKm / (s.totalDurationMin / 60) : 0), display: (v) => v.toFixed(1) },
  { key: 'consistency', label: '꾸준함', unit: '회', max: 50, value: (s) => s.rideCount, display: (v) => Math.round(v) },
];

function buildAbilities(stats) {
  if (!stats) return [];
  const raw = ABILITY_DEFS.map((def) => {
    const value = def.value(stats) || 0;
    return { ...def, value, rawPct: Math.min(value / def.max, 1) * 100 };
  });
  const maxRawPct = Math.max(...raw.map((r) => r.rawPct), 0);
  return raw.map((r) => ({ ...r, barPct: maxRawPct > 0 ? (r.rawPct / maxRawPct) * 100 : 0 }));
}

function fmtRideDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

const formOf = (p) => ({
  bio: p?.bio || '',
  bikeInfo: p?.bikeInfo || '',
  gender: p?.gender || 'none',
  age: p?.age ?? '',
  region: p?.region || '',
});

// 프로필 페이지 — 로그인 사용자 정보 + 기본 프로필(성별/나이/지역/자전거) + 라이딩 통계.
export default function ProfilePage({ user, onMoveHome, onMoveBrowse, onMoveParty, onOpenMap, onMoveCrew }) {
  const letter = (user?.name || '?').trim().charAt(0);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(formOf(null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    Promise.all([getProfile(user.id), getRideStats(user.id), getRideHistory(user.id)])
      .then(([p, s, h]) => {
        if (!alive) return;
        setProfile(p);
        setStats(s);
        setHistory(h || []);
        setForm(formOf(p));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.id]);

  // 막대를 0%로 한 번 그린 다음 다음 프레임에 실제 값으로 바꿔서 "처음부터 쭉 차오르는" 효과를 낸다.
  // stats가 로드된 직후 바로 목표값으로 그리면 트랜지션이 안 먹어서 rAF 두 번으로 한 프레임 쉬어준다.
  useEffect(() => {
    if (!stats) return;
    setBarsReady(false);
    let raf2;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setBarsReady(true)); });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [stats]);

  const abilities = buildAbilities(stats);

  const startEdit = () => { setError(''); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setError(''); setForm(formOf(profile)); };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateProfile(user.id, {
        bio: form.bio,
        bikeInfo: form.bikeInfo,
        gender: form.gender,
        age: form.age === '' ? null : Number(form.age),
        region: form.region,
      });
      setProfile(updated);
      setEditing(false);
    } catch {
      setError('저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="accountPage">
      <nav className="navbar accountNav" aria-label={text.nav}>
        <a className="brand" href="/" onClick={onMoveHome}><BrandLogo className="brandLogo" />PedalLink</a>
        <div className="navLinks">
          <a href="/browse" onClick={onMoveBrowse}>{text.feed}</a>
          <a href="/party" onClick={onMoveParty}>{text.party}</a>
          <a href="/crew" onClick={onMoveCrew}>{text.crew}</a>
          <a href="/map" onClick={onOpenMap}>{text.makeCourse}</a>
        </div>
        <a className="signupBackLink" href="/" onClick={onMoveHome}>{text.partyBackHome}</a>
      </nav>

      <main className="accountMain">
        <header className="accountHead">
          <span className="accountAvatar" aria-hidden="true">{letter}</span>
          <div>
            <h1>{user?.name}님</h1>
            <p>{user?.email || account.memberFallback}</p>
            {profile?.bio && <p className="accountBio">{profile.bio}</p>}
          </div>
        </header>

        <section className="accountCard">
          <h2>라이딩 통계</h2>
          <div className="accountStats">
            <div className="accountStat"><strong>{stats ? stats.rideCount : '-'}</strong><span>라이딩 횟수</span></div>
            <div className="accountStat"><strong>{stats ? stats.totalDistanceKm.toFixed(1) : '-'}</strong><span>총 거리(km)</span></div>
            <div className="accountStat"><strong>{stats ? stats.totalDurationMin : '-'}</strong><span>총 시간(분)</span></div>
            <div className="accountStat"><strong>{stats ? stats.totalAscendM : '-'}</strong><span>총 상승고도(m)</span></div>
            <div className="accountStat"><strong>{stats ? stats.mountainRideCount : '-'}</strong><span>산악 코스 완주</span></div>
          </div>
          {stats?.totalAscendM > 0 && (
            <p className="accountAchieve">
              🏔️ 지금까지 오른 높이는 에베레스트산의 {((stats.totalAscendM / EVEREST_M) * 100).toFixed(1)}%예요
            </p>
          )}
          {stats?.mountainRideCount > 0 && (
            <p className="accountAchieve">
              🚵 상승고도 {stats.mountainThresholdM}m 이상 코스를 {stats.mountainRideCount}번 완주한 산악 라이더예요
            </p>
          )}
        </section>

        {abilities.length > 0 && (
          <section className="accountCard">
            <h2>라이더 역량</h2>
            <ul className="accountAbilityList">
              {abilities.map((a, i) => (
                <li key={a.key} className="accountAbilityRow">
                  <span className="accountAbilityLabel">{a.label}</span>
                  <span className="accountAbilityBarTrack">
                    <span
                      className="accountAbilityBarFill"
                      style={{ width: barsReady ? `${a.barPct}%` : '0%', transitionDelay: `${i * 0.1}s` }}
                    />
                  </span>
                  <span className="accountAbilityValue">{a.display(a.value)}{a.unit}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="accountCard">
          <h2>라이딩 기록</h2>
          {!history ? (
            <p className="accountEmptyHint">불러오는 중…</p>
          ) : history.length === 0 ? (
            <p className="accountEmptyHint">아직 라이딩 기록이 없어요. 라이딩을 시작해보세요!</p>
          ) : (
            <ul className="accountRideList">
              {history.map((r) => {
                const isMountain = stats?.mountainThresholdM != null && r.ascendM >= stats.mountainThresholdM;
                return (
                  <li key={r.id} className="accountRideRow">
                    <div className="accountRideMain">
                      <strong>{r.routeName || '자유주행'}</strong>
                      {isMountain && <span className="accountMountainBadge">🏔️ 산악</span>}
                    </div>
                    <div className="accountRideMeta">
                      <span className="accountRideMetaDate">{fmtRideDate(r.ridedAt)}</span>
                      <span className="accountRideMetaDist">{r.distanceKm.toFixed(1)}km</span>
                      <span className="accountRideMetaDur">{r.durationMin}분</span>
                      <span className="accountRideMetaAscend">{r.ascendM != null ? `↑${r.ascendM}m` : ''}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="accountCard">
          <div className="accountCardHead">
            <h2>기본 정보</h2>
            {!editing && <button type="button" className="accountEditBtn" onClick={startEdit}>수정</button>}
          </div>

          {editing ? (
            <div className="accountEditGrid">
              <label className="accountField">
                <span>한줄소개</span>
                <input
                  type="text" maxLength={80} value={form.bio} placeholder="자기소개를 적어주세요"
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                />
              </label>
              <label className="accountField">
                <span>보유 자전거</span>
                <input
                  type="text" value={form.bikeInfo} placeholder="예: 삼천리 로드바이크"
                  onChange={(e) => setForm((f) => ({ ...f, bikeInfo: e.target.value }))}
                />
              </label>
              <label className="accountField">
                <span>성별</span>
                <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                  <option value="none">선택 안 함</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </label>
              <label className="accountField">
                <span>나이</span>
                <input
                  type="number" min="1" max="120" value={form.age} placeholder="예: 25"
                  onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                />
              </label>
              <label className="accountField">
                <span>지역</span>
                <input
                  type="text" value={form.region} placeholder="예: 서울시 마포구"
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                />
              </label>

              {error && <p className="accountError">{error}</p>}

              <div className="accountEditActions">
                <button type="button" className="accountGhostBtn" onClick={cancelEdit} disabled={saving}>취소</button>
                <button type="button" className="accountSaveBtn" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
              </div>
            </div>
          ) : (
            <ul className="accountList">
              <li>성별<span>{GENDER_LABEL[profile?.gender] || '선택 안 함'}</span></li>
              <li>나이<span>{profile?.age ?? '-'}</span></li>
              <li>지역<span>{profile?.region || '-'}</span></li>
              <li>보유 자전거<span>{profile?.bikeInfo || '-'}</span></li>
            </ul>
          )}
        </section>

        <section className="accountCard">
          <h2>{account.profileActivityTitle}</h2>
          <ul className="accountList">
            {account.profileActivity.map((label) => (
              <li key={label}>{label}<span className="accountSoon">{account.soon}</span></li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
