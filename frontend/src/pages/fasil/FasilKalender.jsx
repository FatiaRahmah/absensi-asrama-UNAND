import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Empty, ErrorBox, Loading, Modal, PageHeader, StatusPill, useFetch, useToast } from '../../components/ui.jsx';
import { MONTHS_LONG, fmtDate, pad } from '../../utils.js';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function shiftMonth(bulan, delta) {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function dayTone(day) {
  const list = [day?.subuh?.status, day?.malam?.status].filter(Boolean);
  if (!list.length) return '';
  if (list.includes('alpa')) return 'alpa';
  if (list.includes('izin')) return 'izin';
  return 'hadir';
}

export default function FasilKalender() {
  const { nim } = useParams();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const bulan = /^\d{4}-\d{2}$/.test(params.get('bulan') || '') ? params.get('bulan') : `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const { data, loading, error, reload } = useFetch(() => api.get(`/binaan/${nim}/kalender`, { bulan }), [nim, bulan]);
  const [edit, setEdit] = useState(null);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const [y, m] = bulan.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <>
      <PageHeader title={data.penghuni.nama} subtitle={`Kalender kehadiran binaan • NIM ${data.penghuni.nim}`}>
        <Link className="btn btn-outline" to="/fasil/rekap">← Kembali ke rekap</Link>
      </PageHeader>

      <div className="card">
        <div className="calendar-head">
          <button className="btn btn-outline btn-sm" onClick={() => setParams({ bulan: shiftMonth(bulan, -1) })}>‹</button>
          <h3>{MONTHS_LONG[m - 1]} {y}</h3>
          <button className="btn btn-outline btn-sm" onClick={() => setParams({ bulan: shiftMonth(bulan, 1) })}>›</button>
        </div>
        <div className="legend">
          <span><i className="dot hadir" /> Hadir</span><span><i className="dot izin" /> Izin</span><span><i className="dot alpa" /> Alpa</span>
          <span className="muted small">• Total bulan ini: {data.ringkasan.hadir} hadir, {data.ringkasan.izin} izin, {data.ringkasan.alpa} alpa</span>
        </div>
        <div className="calendar">
          {WEEKDAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} className="cal-cell empty" />;
            const key = `${bulan}-${pad(day)}`;
            const info = data.hari[key];
            return (
              <div key={key} className={`cal-cell ${dayTone(info)}`}>
                <div className="cal-day">{day}</div>
                {['subuh', 'malam'].map(sesi => {
                  const rec = info?.[sesi];
                  const editable = data.koreksiFasil && rec && ['alpa', 'izin'].includes(rec.status);
                  return (
                    <button key={sesi} type="button" className={`cal-sesi ${rec?.status || 'none'}`} disabled={!editable}
                      title={editable ? 'Klik untuk koreksi status' : rec?.keterangan || ''}
                      onClick={() => setEdit({ id: rec.id, tanggal: key, sesi, status: rec.status })}>
                      <span>{sesi === 'subuh' ? 'S' : 'M'}</span>{rec ? rec.status : '–'}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="muted small">S = Subuh, M = Malam. Tanpa jam, foto, maupun lokasi.
          {data.koreksiFasil ? ' Klik sesi berstatus alpa/izin untuk mengoreksi.' : ''}</p>
      </div>

      <div className="card">
        <h3>Riwayat Izin Binaan</h3>
        {!data.izin.length ? <Empty>Belum ada pengajuan izin.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tanggal Izin</th><th>Diajukan</th><th>Alasan</th><th>Bukti</th><th>Status</th></tr></thead>
              <tbody>
                {data.izin.map(i => (
                  <tr key={i.id}>
                    <td>{fmtDate(i.tanggal)}</td><td className="muted small">{i.diajukan}</td>
                    <td className="small">{i.alasan}</td>
                    <td>{i.file_bukti ? <a className="link" href={i.file_bukti} target="_blank" rel="noreferrer">Buka berkas</a> : '-'}</td>
                    <td><StatusPill status={i.status_izin} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && <CorrectionModal edit={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); toast('Status berhasil dikoreksi.'); }} />}
    </>
  );
}

function CorrectionModal({ edit, onClose, onDone }) {
  const toast = useToast();
  const [status, setStatus] = useState(edit.status === 'alpa' ? 'izin' : 'alpa');
  const [keterangan, setKeterangan] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/presensi/${edit.id}`, { status, keterangan });
      onDone();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal title="Koreksi Status" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="small">{fmtDate(edit.tanggal)} • Sesi {edit.sesi} • status saat ini <StatusPill status={edit.status} /></p>
        <label className="form-group"><span className="form-label">Status baru</span>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="izin">Izin</option><option value="alpa">Alpa</option>
          </select></label>
        <label className="form-group"><span className="form-label">Keterangan (wajib)</span>
          <textarea className="form-textarea" required minLength={3} value={keterangan} onChange={e => setKeterangan(e.target.value)}
            placeholder="Contoh: surat dokter menyusul" /></label>
        <div className="btn-row">
          <button type="button" className="btn btn-outline" onClick={onClose}>Batal</button>
          <button className="btn btn-primary grow" disabled={busy}>Simpan Koreksi</button>
        </div>
      </form>
    </Modal>
  );
}
