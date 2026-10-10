import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Logo } from '../components/Layout.jsx';

export default function Login() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <Logo size={52} />
          <div>
            <h2>Portal Asrama UNAND</h2>
            <p>Sistem Presensi & Monitoring Terpadu</p>
          </div>
        </div>
        <label className="form-group">
          <span className="form-label">NIM / NIP / Email</span>
          <input id="login-identifier" className="form-input" value={identifier} onChange={e => setIdentifier(e.target.value)}
            placeholder="Masukkan NIM, NIP, atau email" required autoFocus />
        </label>
        <label className="form-group">
          <span className="form-label">Password</span>
          <div className="password-wrap">
            <input id="login-password" className="form-input" type={show ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Masukkan kata sandi" required />
            <button type="button" className="toggle-pw" onClick={() => setShow(s => !s)}>{show ? 'Sembunyikan' : 'Tampilkan'}</button>
          </div>
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button id="login-submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Memproses...' : 'Masuk ke Portal'}
        </button>
      </form>
    </div>
  );
}
