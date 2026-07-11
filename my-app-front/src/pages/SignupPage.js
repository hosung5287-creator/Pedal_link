import { useState } from 'react';
import { text } from '../constants';
import heroBg from '../backglound1.png';

const initialForm = { name: '', email: '', password: '', passwordCheck: '' };

export default function SignupPage({ onMoveHome }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(text.signupNeedName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError(text.signupNeedEmail);
    if (form.password.length < 8) return setError(text.signupNeedPassword);
    if (form.password !== form.passwordCheck) return setError(text.signupMismatch);
    setDone(true);
  };

  return (
    <div className="signupPage" style={{ backgroundImage: `url(${heroBg})` }}>
      <nav className="navbar" aria-label={text.nav}>
        <a className="brand" href="/" onClick={onMoveHome}>PedalLink</a>
        <a className="signupBackLink" href="/" onClick={onMoveHome}>{text.backHome}</a>
      </nav>

      <div className="signupLayout">
        <div className="signupIntro">
          <p className="eyebrow">{text.signupEyebrow}</p>
          <h1 className="signupHeadline">{text.signupHeadline}</h1>
          <p className="signupSub">{text.signupSub}</p>
          <ul className="signupPerks">
            <li>{text.signupPerk1}</li>
            <li>{text.signupPerk2}</li>
            <li>{text.signupPerk3}</li>
          </ul>
        </div>

        <div className="signupCard">
          {done ? (
            <div className="signupDone">
              <span className="signupDoneIcon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <h2>{text.signupDoneTitle}</h2>
              <p>{text.signupDoneSub.replace('{name}', form.name)}</p>
              <button className="signupButton" type="button" onClick={onMoveHome}>{text.backHome}</button>
            </div>
          ) : (
            <>
              <h2 className="signupCardTitle">{text.signupCardTitle}</h2>
              <p className="signupCardSub">{text.signupCardSub}</p>
              <form className="signupForm" onSubmit={handleSubmit} noValidate>
                <label className="signupField">
                  <span>{text.signupName}</span>
                  <input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder={text.signupNamePlaceholder}
                    autoComplete="name"
                  />
                </label>
                <label className="signupField">
                  <span>{text.signupEmail}</span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder={text.signupEmailPlaceholder}
                    autoComplete="email"
                  />
                </label>
                <label className="signupField">
                  <span>{text.signupPassword}</span>
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder={text.signupPasswordPlaceholder}
                    autoComplete="new-password"
                  />
                </label>
                <label className="signupField">
                  <span>{text.signupPasswordCheck}</span>
                  <input
                    name="passwordCheck"
                    type="password"
                    value={form.passwordCheck}
                    onChange={handleChange}
                    placeholder={text.signupPasswordCheckPlaceholder}
                    autoComplete="new-password"
                  />
                </label>

                {error && <p className="signupError" role="alert">{error}</p>}

                <button className="signupButton" type="submit">{text.signup}</button>
              </form>

              <div className="signupDivider"><span>{text.signupSocialDivider}</span></div>

              <div className="signupSocial">
                <button className="socialButton socialGoogle" type="button">
                  <span className="socialIcon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                  </span>
                  {text.signupGoogle}
                </button>
                <button className="socialButton socialNaver" type="button">
                  <span className="socialIcon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#ffffff">
                      <path d="M16.27 12.85 7.55 0H0v24h7.73V11.15L16.45 24H24V0h-7.73v12.85z"/>
                    </svg>
                  </span>
                  {text.signupNaver}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
