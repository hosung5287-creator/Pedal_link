import '../styles/account.css';

import { useEffect, useState } from 'react';
import BrandLogo from '../components/BrandLogo';
import { text, account } from '../constants';
import { getProfile, updateProfile } from '../api/users';
import { getRideStats } from '../api/rides';

const GENDER_LABEL = { male: '남성', female: '여성', none: '선택 안 함' };

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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(formOf(null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    Promise.all([getProfile(user.id), getRideStats(user.id)])
      .then(([p, s]) => {
        if (!alive) return;
        setProfile(p);
        setStats(s);
        setForm(formOf(p));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.id]);

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
          </div>
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
