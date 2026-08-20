import '../styles/auth.css';

import { useState } from 'react';
import { text } from '../constants';
import heroBg from '../backglound1.png';
import { login } from '../api/auth';
import SocialLoginButtons from '../components/SocialLoginButtons';

const initialForm = { email: '', password: '' };

export default function LoginPage({ onMoveHome, onMoveSignup, onLogin }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError(text.loginNeedEmail);
    if (!form.password) return setError(text.loginNeedPassword);

    setSubmitting(true);
    try {
      const userData = await login(form);
      onLogin(userData);
    } catch (err) {
      setError(err.message || text.loginFailed);
    } finally {
      setSubmitting(false);
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
          <p className="eyebrow">{text.loginEyebrow}</p>
          <h1 className="signupHeadline">{text.loginHeadline}</h1>
          <p className="signupSub">{text.loginSub}</p>
          <ul className="signupPerks">
            <li>{text.loginPerk1}</li>
            <li>{text.loginPerk2}</li>
            <li>{text.loginPerk3}</li>
          </ul>
        </div>

        <div className="signupCard">
          <h2 className="signupCardTitle">{text.loginCardTitle}</h2>
          <p className="signupCardSub">{text.loginCardSub}</p>

          <form className="signupForm" onSubmit={handleSubmit} noValidate>
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
                placeholder={text.loginPasswordPlaceholder}
                autoComplete="current-password"
              />
            </label>

            {error && <p className="signupError" role="alert">{error}</p>}

            <button className="signupButton" type="submit" disabled={submitting}>
              {text.loginButton}
            </button>
          </form>

          <SocialLoginButtons />

          <p className="authSwitch">
            {text.loginToSignup}{' '}
            <a href="/signup" onClick={onMoveSignup}>{text.loginSignupLink}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
