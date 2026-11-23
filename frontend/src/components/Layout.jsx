import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Modal } from './ui.jsx';

const Logo = ({ size = 38 }) => (
  <img
    src="/logo-unand.png"
    width={size}
    height={size}
    alt="Logo Universitas Andalas"
    className="unand-logo"
  />
);
export { Logo };

const icon = d => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const ICONS = {
  camera: icon(['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z']),
  file: icon(['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8']),
  shield: icon(['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4']),
  chart: icon(['M3 3v18h18', 'M7 15l4-5 4 3 5-7']),
  users: icon(['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75']),
  history: icon(['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l3 2'])
};

const NAV = {
  penghuni: [
    { to: '/presensi', label: 'Presensi Kamera', icon: 'camera' },
    { to: '/riwayat', label: 'Riwayat & Form Izin', icon: 'file' }
  ],
  fasil: [
    { to: '/fasil', label: 'Dashboard Fasilitator', icon: 'shield', end: true },
    { to: '/fasil/rekap', label: 'Rekap & Riwayat Binaan', icon: 'history' }
  ],
  admin: [
    { to: '/admin', label: 'Monitoring', icon: 'chart', end: true },
    { to: '/admin/pengguna', label: 'Manajemen Pengguna', icon: 'users' },
    { to: '/admin/riwayat', label: 'Riwayat Presensi', icon: 'history' }
  ]
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeWithEscape = event => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeWithEscape);
    return () => window.removeEventListener('keydown', closeWithEscape);
  }, [menuOpen]);

  return (
    <div className="app-container">
      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Tutup menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen ? undefined : false}>
        <div>
          <div className="sidebar-brand">
            <Logo />
            <div>
              <h2>Portal Asrama</h2>
              <p>Universitas Andalas</p>
            </div>
            <button
              type="button"
              className="sidebar-close"
              aria-label="Tutup menu"
              onClick={() => setMenuOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="sidebar-subcard">
            <span className="subcard-badge">{user.roleTitle.toUpperCase()}</span>
            <div className="subcard-title">Sistem Presensi & Monitoring Terpadu</div>
          </div>
          <nav className="sidebar-nav">
            {NAV[user.role].map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                {ICONS[item.icon]}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <span>Asrama UNAND</span>
          <span className="pill-green">v2.0</span>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="top-header">
          <div className="top-header-left">
            <button
              type="button"
              className="menu-toggle"
              aria-label="Buka menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
            <span className="portal-tag">ASRAMA UNAND</span>
            <span className="header-subtitle">Sistem Informasi Presensi Digital Mahasiswa</span>
          </div>
          <div className="user-profile">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.roleTitle} • {user.nim}</span>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setConfirmLogout(true)}>Keluar ↵</button>
          </div>
        </header>
        <main className="content-body">
          <Outlet />
        </main>
      </div>
      {confirmLogout && (
        <Modal title="Konfirmasi Keluar" onClose={() => setConfirmLogout(false)}>
          <p>Apakah Anda yakin ingin keluar dari akun <strong>{user.name}</strong>?</p>
          <div className="btn-row">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmLogout(false)}>Batal</button>
            <button type="button" className="btn btn-primary grow" autoFocus onClick={logout}>Ya, Keluar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
