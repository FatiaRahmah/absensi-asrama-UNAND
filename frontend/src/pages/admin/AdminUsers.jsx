import { useMemo, useState } from 'react';
import { api } from '../../api.js';
import { Empty, ErrorBox, Loading, Modal, PageHeader, useFetch, useToast } from '../../components/ui.jsx';

const ROLE_LABEL = { admin: 'Admin', fasil: 'Fasilitator', penghuni: 'Penghuni' };
const EMPTY_FORM = {
  role: 'penghuni', nim_nip: '', nama: '', email: '', password: '', aktif: true,
  gedung_kamar: '', id_kamar: '', fasil_id: '', gedung_id: ''
};

export default function AdminUsers() {
  const toast = useToast();
  const [tab, setTab] = useState('pengguna');
  const users = useFetch(() => api.get('/users'), []);
  const gedung = useFetch(() => api.get('/gedung'), []);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | user

  const list = users.data?.users || [];
  const binaanCount = useMemo(() => {
    const map = {};
    list.forEach(u => { if (u.fasil_id && u.role === 'penghuni') map[u.fasil_id] = (map[u.fasil_id] || 0) + 1; });
    return map;
  }, [list]);

  const filtered = list.filter(u =>
    (!roleFilter || u.role === roleFilter) &&
    (!search || `${u.nama} ${u.nim_nip} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
  );

  const reloadAll = () => { users.reload(); gedung.reload(); };

  const toggleActive = async u => {
    try {
      await api.put(`/users/${u.nim_nip}`, { aktif: !u.aktif });
      toast(u.aktif ? 'Akun dinonaktifkan.' : 'Akun diaktifkan.');
      users.reload();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <>
      <PageHeader title="Manajemen Pengguna" subtitle="Kelola akun penghuni, fasilitator, admin, serta penempatan gedung, kamar, dan fasil.">
        {tab === 'pengguna' && <button id="btn-new-user" className="btn btn-primary" onClick={() => setEditing('new')}>＋ Buat Akun Baru</button>}
      </PageHeader>

      <div className="tabs">
        <button className={`tab ${tab === 'pengguna' ? 'active' : ''}`} onClick={() => setTab('pengguna')}>Pengguna</button>
        <button className={`tab ${tab === 'gedung' ? 'active' : ''}`} onClick={() => setTab('gedung')}>Gedung & Kamar</button>
      </div>

      {tab === 'pengguna' ? (
        <div className="card">
          <div className="filter-bar inline">
            <input className="form-input" placeholder="Cari nama, NIM/NIP, atau email" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="">Semua role</option>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <span className="muted small">{filtered.length} akun</span>
          </div>
          {users.loading && !users.data ? <Loading /> : users.error ? <ErrorBox message={users.error} onRetry={users.reload} /> :
            !filtered.length ? <Empty>Tidak ada pengguna.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Nama</th><th>NIM/NIP</th><th>Role</th><th>Gedung / Kamar</th><th>Fasil</th><th>Status</th><th className="num">Aksi</th></tr></thead>
                  <tbody>
                    {filtered.map(u => (
                      <tr key={u.nim_nip} className={u.aktif ? '' : 'muted-row'}>
                        <td><strong>{u.nama}</strong><div className="muted small">{u.email}</div></td>
                        <td>{u.nim_nip}</td>
                        <td><span className={`pill role-${u.role}`}>{ROLE_LABEL[u.role]}</span></td>
                        <td className="small">
                          {u.role === 'penghuni' && (u.kamar ? `${u.kamar.gedung.nama_gedung} / ${u.kamar.no_kamar}` : <span className="c-red">Belum ada kamar</span>)}
                          {u.role === 'fasil' && (u.gedung ? `PJ: ${u.gedung.nama} (${binaanCount[u.nim_nip] || 0} binaan)` : <span className="c-red">Belum ditempatkan • {binaanCount[u.nim_nip] || 0} binaan</span>)}
                          {u.role === 'admin' && '-'}
                        </td>
                        <td className="small">{u.role === 'penghuni' ? (u.fasil_nama || <span className="c-red">Belum ada fasil</span>) : '-'}</td>
                        <td><span className={`pill ${u.aktif ? 'hadir' : 'alpa'}`}>{u.aktif ? 'Aktif' : 'Nonaktif'}</span></td>
                        <td className="num actions">
                          <button className="btn btn-outline btn-sm" onClick={() => setEditing(u)}>Edit</button>
                          <button className="btn btn-outline btn-sm" onClick={() => toggleActive(u)}>{u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      ) : (
        <GedungKamar gedungs={gedung.data?.gedungs || []} loading={gedung.loading && !gedung.data} reload={reloadAll} />
      )}

      {editing && (
        <UserForm user={editing === 'new' ? null : editing} gedungs={gedung.data?.gedungs || []}
          fasils={list.filter(u => u.role === 'fasil' && u.aktif)}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reloadAll(); }} />
      )}
    </>
  );
}

function UserForm({ user, gedungs, fasils, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(user);
  const [form, setForm] = useState(() => isEdit ? {
    role: user.role, nim_nip: user.nim_nip, nama: user.nama, email: user.email, password: '', aktif: user.aktif,
    gedung_kamar: user.kamar?.gedung_id ? String(user.kamar.gedung_id) : '', id_kamar: user.kamar_id ? String(user.kamar_id) : '',
    fasil_id: user.fasil_id || '', gedung_id: user.gedung_id ? String(user.gedung_id) : ''
  } : EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const kamars = gedungs.find(g => String(g.id) === form.gedung_kamar)?.kamar || [];

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      nim_nip: form.nim_nip.trim(), nama: form.nama.trim(), email: form.email.trim(), role: form.role, aktif: form.aktif,
      id_kamar: form.role === 'penghuni' ? form.id_kamar || null : null,
      fasil_id: form.role === 'penghuni' ? form.fasil_id || null : null,
      gedung_id: form.role === 'fasil' ? form.gedung_id || null : null
    };
    if (form.password) payload.password = form.password;
    try {
      if (isEdit) await api.put(`/users/${user.nim_nip}`, payload);
      else await api.post('/users', payload);
      toast(isEdit ? 'Data pengguna diperbarui.' : 'Akun berhasil dibuat.');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? `Edit ${user.nama}` : 'Buat Akun Baru'} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        <label className="form-group"><span className="form-label">Role *</span>
          <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="form-group"><span className="form-label">{form.role === 'penghuni' ? 'NIM *' : 'NIP / ID *'}</span>
          <input className="form-input" value={form.nim_nip} required disabled={isEdit} onChange={e => set('nim_nip', e.target.value)} /></label>
        <label className="form-group"><span className="form-label">Nama lengkap *</span>
          <input className="form-input" value={form.nama} required onChange={e => set('nama', e.target.value)} /></label>
        <label className="form-group"><span className="form-label">Email *</span>
          <input className="form-input" type="email" value={form.email} required placeholder="nama@domain.com" onChange={e => set('email', e.target.value)} /></label>
        <label className="form-group"><span className="form-label">{isEdit ? 'Password baru (opsional)' : 'Password *'}</span>
          <input className="form-input" type="password" minLength={6} value={form.password} required={!isEdit}
            placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'} onChange={e => set('password', e.target.value)} /></label>
        <label className="form-group check"><input type="checkbox" checked={form.aktif} onChange={e => set('aktif', e.target.checked)} /> Akun aktif</label>

        {form.role === 'penghuni' && (
          <>
            <label className="form-group"><span className="form-label">Gedung</span>
              <select className="form-select" value={form.gedung_kamar} onChange={e => { set('gedung_kamar', e.target.value); set('id_kamar', ''); }}>
                <option value="">— Pilih gedung —</option>
                {gedungs.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
              </select></label>
            <label className="form-group"><span className="form-label">Kamar</span>
              <select className="form-select" value={form.id_kamar} disabled={!form.gedung_kamar} onChange={e => set('id_kamar', e.target.value)}>
                <option value="">— Pilih kamar —</option>
                {kamars.map(k => <option key={k.id} value={k.id}>{k.no_kamar} (Lt. {k.lantai}) • {k.terisi}/{k.kapasitas}</option>)}
              </select></label>
            <label className="form-group full"><span className="form-label">Fasilitator penanggung jawab</span>
              <select className="form-select" value={form.fasil_id} onChange={e => set('fasil_id', e.target.value)}>
                <option value="">— Belum ada fasil —</option>
                {fasils.map(f => <option key={f.nim_nip} value={f.nim_nip}>{f.nama}{f.gedung ? ` — ${f.gedung.nama}` : ''}</option>)}
              </select></label>
          </>
        )}
        {form.role === 'fasil' && (
          <label className="form-group full"><span className="form-label">Gedung yang diurus</span>
            <select className="form-select" value={form.gedung_id} onChange={e => set('gedung_id', e.target.value)}>
              <option value="">— Belum ditempatkan —</option>
              {gedungs.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
            </select></label>
        )}
        <div className="btn-row full">
          <button type="button" className="btn btn-outline" onClick={onClose}>Batal</button>
          <button className="btn btn-primary grow" disabled={busy}>{busy ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Akun'}</button>
        </div>
      </form>
    </Modal>
  );
}

function GedungKamar({ gedungs, loading, reload }) {
  const toast = useToast();
  const [namaGedung, setNamaGedung] = useState('');
  const [kamar, setKamar] = useState({ gedung_id: '', no_kamar: '', lantai: 1, kapasitas: 2 });

  const run = async (fn, ok) => {
    try { await fn(); toast(ok); reload(); } catch (err) { toast(err.message, 'error'); }
  };

  if (loading) return <Loading />;
  return (
    <div className="grid-2">
      <div className="card">
        <h3>Tambah Gedung</h3>
        <form className="inline-form" onSubmit={e => { e.preventDefault(); run(() => api.post('/gedung', { nama: namaGedung }), 'Gedung ditambahkan.').then(() => setNamaGedung('')); }}>
          <input className="form-input" required placeholder="Nama gedung" value={namaGedung} onChange={e => setNamaGedung(e.target.value)} />
          <button className="btn btn-primary">Tambah</button>
        </form>
        <h3 style={{ marginTop: 20 }}>Tambah Kamar</h3>
        <form className="form-grid" onSubmit={e => { e.preventDefault(); run(() => api.post('/kamar', kamar), 'Kamar ditambahkan.'); }}>
          <label className="form-group full"><span className="form-label">Gedung</span>
            <select className="form-select" required value={kamar.gedung_id} onChange={e => setKamar({ ...kamar, gedung_id: e.target.value })}>
              <option value="">— Pilih gedung —</option>
              {gedungs.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
            </select></label>
          <label className="form-group"><span className="form-label">No. kamar</span>
            <input className="form-input" required value={kamar.no_kamar} onChange={e => setKamar({ ...kamar, no_kamar: e.target.value })} /></label>
          <label className="form-group"><span className="form-label">Lantai</span>
            <input className="form-input" type="number" min="1" value={kamar.lantai} onChange={e => setKamar({ ...kamar, lantai: e.target.value })} /></label>
          <label className="form-group"><span className="form-label">Kapasitas</span>
            <input className="form-input" type="number" min="1" value={kamar.kapasitas} onChange={e => setKamar({ ...kamar, kapasitas: e.target.value })} /></label>
          <div className="btn-row full"><button className="btn btn-primary grow">Tambah Kamar</button></div>
        </form>
      </div>
      <div className="card">
        <h3>Daftar Gedung & Kamar</h3>
        {gedungs.map(g => (
          <details key={g.id} className="gedung-item">
            <summary><strong>{g.nama}</strong> <span className="muted small">{g.kamar.length} kamar</span></summary>
            {!g.kamar.length ? <div className="muted small">Belum ada kamar.</div> : (
              <ul className="list">
                {g.kamar.map(k => (
                  <li key={k.id}>
                    <span>Kamar {k.no_kamar} • Lt. {k.lantai} <span className="muted small">({k.terisi}/{k.kapasitas} terisi)</span></span>
                    <button className="btn btn-danger btn-sm" disabled={k.terisi > 0} title={k.terisi ? 'Masih ada penghuni' : ''}
                      onClick={() => window.confirm(`Hapus kamar ${k.no_kamar}?`) && run(() => api.del(`/kamar/${k.id}`), 'Kamar dihapus.')}>Hapus</button>
                  </li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}
