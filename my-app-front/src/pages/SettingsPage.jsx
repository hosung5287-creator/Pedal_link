import '../styles/account.css';

import { useEffect, useState } from 'react';
import BrandLogo from '../components/BrandLogo';
import { text, account, partyDock } from '../constants';
import { getProfile, changeEmail, changePassword } from '../api/users';
import { useLocationShare } from '../hooks/useLocationShare';
import { errorMessage } from '../api/client';

// 회원가입(SignupPage)·백엔드(UserController)와 같은 규칙 — 한쪽만 바뀌지 않도록 같이 맞춘다
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const emptyEmailForm = { newEmail: '', currentPassword: '' };
const emptyPasswordForm = { currentPassword: '', newPassword: '', newPasswordCheck: '' };

// 설정 페이지 — 이메일/비밀번호 변경 · 위치 공유 + 로그아웃.
export default function SettingsPage({ user, onMoveHome, onMoveBrowse, onMoveParty, onOpenMap, onLogout, onMoveCrew, onUserUpdate }) {
  const [open, setOpen] = useState(null); // 'email' | 'password' | null — 폼은 한 번에 하나만 연다
  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [locShare, setLocShare] = useLocationShare(user?.id);

  // 다른 기기에서 이메일을 바꿨을 수 있어서, 들어올 때 서버 값으로 로그인 정보를 맞춘다
  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    getProfile(user.id)
      .then((p) => {
        if (alive && p?.email && p.email !== user.email) onUserUpdate?.({ email: p.email });
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const resetForms = () => {
    setError('');
    setEmailForm(emptyEmailForm);
    setPasswordForm(emptyPasswordForm);
  };
  const openForm = (which) => { resetForms(); setNotice(''); setOpen(which); };
  const closeForm = () => { resetForms(); setOpen(null); };

  const submitEmail = async (e) => {
    e.preventDefault();
    const newEmail = emailForm.newEmail.trim();
    if (!EMAIL_RE.test(newEmail)) return setError(text.signupNeedEmail);
    if (!emailForm.currentPassword) return setError(account.settingsNeedCurrentPassword);

    setSaving(true);
    setError('');
    try {
      const updated = await changeEmail(user.id, { currentPassword: emailForm.currentPassword, newEmail });
      onUserUpdate?.({ email: updated?.email ?? newEmail });
      closeForm();
      setNotice(account.settingsEmailDone);
    } catch (err) {
      // 비밀번호 틀림(401)·이미 쓰는 이메일(409)·소셜 계정(400) 문구를 서버가 한국어로 준다
      setError(errorMessage(err, account.settingsFailed));
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) return setError(account.settingsNeedCurrentPassword);
    if (passwordForm.newPassword.length < MIN_PASSWORD) return setError(text.signupNeedPassword);
    if (passwordForm.newPassword !== passwordForm.newPasswordCheck) return setError(text.signupMismatch);

    setSaving(true);
    setError('');
    try {
      await changePassword(user.id, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      closeForm();
      setNotice(account.settingsPasswordDone);
    } catch (err) {
      setError(errorMessage(err, account.settingsFailed));
    } finally {
      setSaving(false);
    }
  };

  const formActions = (
    <div className="accountEditActions">
      <button type="button" className="accountGhostBtn" onClick={closeForm} disabled={saving}>{account.settingsCancel}</button>
      <button type="submit" className="accountSaveBtn" disabled={saving}>{saving ? account.settingsSaving : account.settingsSave}</button>
    </div>
  );

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
          <div>
            <h1>{text.menuSettings}</h1>
            <p>{user?.name}님 계정</p>
          </div>
        </header>

        <section className="accountCard">
          <h2>{account.settingsAccountTitle}</h2>
          {notice && <p className="accountNotice" role="status">{notice}</p>}

          <ul className="accountList">
            <li>
              <span className="accountLabel">{account.settingsEmail}</span>
              <span className="accountValue">{user?.email || '-'}</span>
            </li>

            <li className="accountSettingRow">
              <div className="accountSettingHead">
                <span>{account.settingsEmailChange}</span>
                {open !== 'email' && (
                  <button type="button" className="accountEditBtn" onClick={() => openForm('email')}>{account.settingsChangeBtn}</button>
                )}
              </div>
              {open === 'email' && (
                <form className="accountEditGrid accountSettingForm" onSubmit={submitEmail} noValidate>
                  <label className="accountField">
                    <span>{account.settingsNewEmail}</span>
                    <input
                      type="email" autoComplete="email" value={emailForm.newEmail}
                      onChange={(e) => setEmailForm((f) => ({ ...f, newEmail: e.target.value }))}
                    />
                  </label>
                  <label className="accountField">
                    <span>{account.settingsCurrentPassword}</span>
                    <input
                      type="password" autoComplete="current-password" value={emailForm.currentPassword}
                      onChange={(e) => setEmailForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    />
                  </label>
                  {error && <p className="accountError">{error}</p>}
                  {formActions}
                </form>
              )}
            </li>

            <li className="accountSettingRow">
              <div className="accountSettingHead">
                <span>{account.settingsPasswordChange}</span>
                {open !== 'password' && (
                  <button type="button" className="accountEditBtn" onClick={() => openForm('password')}>{account.settingsChangeBtn}</button>
                )}
              </div>
              {open === 'password' && (
                <form className="accountEditGrid accountSettingForm" onSubmit={submitPassword} noValidate>
                  <label className="accountField">
                    <span>{account.settingsCurrentPassword}</span>
                    <input
                      type="password" autoComplete="current-password" value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    />
                  </label>
                  <label className="accountField">
                    <span>{account.settingsNewPassword}</span>
                    <input
                      type="password" autoComplete="new-password" value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                    />
                  </label>
                  <label className="accountField">
                    <span>{account.settingsNewPasswordCheck}</span>
                    <input
                      type="password" autoComplete="new-password" value={passwordForm.newPasswordCheck}
                      onChange={(e) => setPasswordForm((f) => ({ ...f, newPasswordCheck: e.target.value }))}
                    />
                  </label>
                  {error && <p className="accountError">{error}</p>}
                  {formActions}
                </form>
              )}
            </li>

            <li>
              <div className="accountSettingText">
                <span>{partyDock.locationShare}</span>
                <small>{locShare ? partyDock.locationShareOn : partyDock.locationShareOff}</small>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={locShare}
                aria-label={partyDock.locationShare}
                className={`accountSwitch${locShare ? ' isOn' : ''}`}
                onClick={() => setLocShare(!locShare)}
              >
                <span className="accountSwitchKnob" />
              </button>
            </li>

            <li>{account.settingsNotify}<span className="accountSoon">{account.soon}</span></li>
          </ul>
        </section>

        <button type="button" className="accountLogout" onClick={onLogout}>{text.logout}</button>
      </main>
    </div>
  );
}
