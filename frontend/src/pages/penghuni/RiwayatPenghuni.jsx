import { useState } from 'react';
import { api } from '../../api.js';
import { Empty, Loading, PageHeader, StatusPill, useFetch, useToast } from '../../components/ui.jsx';
import { SESI_LABEL, fmtDate, todayKey } from '../../utils.js';

const CATEGORIES = ['Tugas / Kegiatan Akademik Kampus', 'Sakit / Alasan Medis', 'Acara Keluarga / Darurat', 'Lainnya'];

export default function RiwayatPenghuni() {
  const toast = useToast();
  const izin = useFetch(() => api.get('/izin'), []);
  const presensi = useFetch(() => api.get('/presensi'), []);
  const [form, setForm] = useState({ tanggal: todayKey(), kategori: CATEGORIES[0], alasan: '', file: null });
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!form.file) return toast('Berkas bukti wajib diunggah', 'warning');
    if (form.file.size > 5 * 1024 * 1024) return toast('Ukuran berkas maksimal 5 MB', 'warning');
    setBusy(true);
    try {
      const body = new FormData();
      body.append('tanggal_izin', form.tanggal);
      body.append('alasan', `[${form.kategori}] ${form.alasan}`);
      body.append('bukti', form.file);
      await api.post('/izin', body);
      toast('Pengajuan izin terkirim, menunggu persetujuan fasil.');
      setForm({ tanggal: todayKey(), kategori: CATEGORIES[0], alasan: '', file: null });
      e.target.reset();
      izin.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Pengajuan Izin & Riwayat Presensi" subtitle="Ajukan dispensasi dan pantau status kehadiran Anda." />
      <div className="grid-2">
        <form className="card" onSubmit={submit}>
          <h3>Formulir Permohonan Izin</h3>
          <p className="muted small">Izin berlaku untuk seluruh sesi (subuh & malam) pada tanggal yang dipilih.</p>
          <label className="form-group">
            <span className="form-label">Kategori Alasan *</span>
            <select className="form-select" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="form-group" style={{ maxWidth: 260 }}>
            <span className="form-label">Tanggal Izin *</span>
            <input type="date" className="form-input" min={todayKey()} value={form.tanggal} required
              onChange={e => setForm({ ...form, tanggal: e.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Keterangan *</span>
            <textarea className="form-textarea" maxLength={300} required value={form.alasan}
              placeholder="Tuliskan tujuan, lokasi kegiatan, atau kondisi medis..."
              onChange={e => setForm({ ...form, alasan: e.target.value })} />
            <span className="muted small right">{form.alasan.length} / 300</span>
          </label>
          <label className="form-group">
            <span className="form-label">Berkas Bukti * (PDF, JPG, PNG — maks 5 MB)</span>
            <input type="file" className="form-input" accept=".pdf,.jpg,.jpeg,.png" required
              onChange={e => setForm({ ...form, file: e.target.files[0] || null })} />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim Pengajuan Izin'}</button>
        </form>

        <div className="card">
          <h3>Status Pengajuan Izin</h3>
          {izin.loading ? <Loading /> : !izin.data?.records.length ? <Empty>Belum ada pengajuan izin.</Empty> : (
            <ul className="list">
              {izin.data.records.map(r => (
                <li key={r.id}>
                  <div>
                    <strong>{fmtDate(r.tanggal)}</strong>
                    <div className="muted small clamp">{r.alasan}</div>
                    {r.file_bukti && <a className="link small" href={r.file_bukti} target="_blank" rel="noreferrer">Lihat bukti</a>}
                  </div>
                  <StatusPill status={r.status_izin} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Riwayat Presensi</h3>
        {presensi.loading ? <Loading /> : !presensi.data?.records.length ? <Empty>Belum ada riwayat presensi.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tanggal</th><th>Sesi</th><th>Jam</th><th>Status</th><th>Keterangan</th></tr></thead>
              <tbody>
                {presensi.data.records.map(r => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.tanggal)}</td>
                    <td>{SESI_LABEL[r.jenis_presensi]}</td>
                    <td>{r.jam || '-'}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td className="muted small">{r.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
