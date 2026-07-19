import { useState } from 'react';
import { text } from '../constants';
import heroBg from '../backglound1.png';
import SocialLoginButtons from '../components/SocialLoginButtons';
import { signup } from '../api/auth';

const initialForm = { name: '', email: '', password: '', passwordCheck: '' };

export default function SignupPage({ onMoveHome, onMoveLogin }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(text.signupNeedName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError(text.signupNeedEmail);
    if (form.password.length < 8) return setError(text.signupNeedPassword);
    if (form.password !== form.passwordCheck) return setError(text.signupMismatch);

    try {
      await signup({ name: form.name, email: form.email, password: form.password });
      setDone(true);
    } catch (err) {
      setError(err.message || '회원가입에 실패했습니다.');
    }
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

              <SocialLoginButtons />

              <p className="authSwitch">
                {text.signupToLogin}{' '}
                <a href="/login" onClick={onMoveLogin}>{text.signupLoginLink}</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
