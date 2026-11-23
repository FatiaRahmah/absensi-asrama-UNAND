import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Logo } from '../components/Layout.jsx';

export default function Login() {
  const { login } = useAuth();
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(nim.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      {/* Background image & animated atmospheric overlays */}
      <div className="login-bg-media" aria-hidden="true" />
      <div className="login-overlay" aria-hidden="true" />
      <div className="login-ambient-orb orb-1" aria-hidden="true" />
      <div className="login-ambient-orb orb-2" aria-hidden="true" />

      <div className="login-container">
        <form className="login-card" onSubmit={submit}>
          <div className="login-brand">
            <div className="login-logo-wrapper">
              <Logo size={52} />
            </div>
            <div className="login-brand-text">
              <span className="login-badge">PORTAL RESMI</span>
              <h2>Portal Asrama UNAND</h2>
              <p>Sistem Presensi &amp; Monitoring Terpadu</p>
            </div>
          </div>

          <div className="login-divider" />

          <div className="form-group">
            <label htmlFor="login-identifier" className="form-label">
              <span>NIM</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="login-identifier"
                className="form-input has-icon"
                value={nim}
                onChange={e => setNim(e.target.value)}
                placeholder="Masukkan NIM Anda"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              <span>Password</span>
            </label>
            <div className="input-with-icon password-wrap">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="login-password"
                className="form-input has-icon"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                required
              />
              <button
                type="button"
                className="toggle-pw-btn"
                onClick={() => setShow(s => !s)}
                title={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {show ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <button id="login-submit" className="btn btn-primary btn-block btn-login-submit" disabled={busy}>
            {busy ? (
              <span className="btn-loading-content">
                <span className="spinner-sm" />
                <span>Memverifikasi...</span>
              </span>
            ) : (
              'Masuk ke Portal'
            )}
          </button>

          <div className="login-footer-info">
            <p>Universitas Andalas • Kampus Limau Manih</p>
          </div>
        </form>
      </div>
    </div>
  );
}
