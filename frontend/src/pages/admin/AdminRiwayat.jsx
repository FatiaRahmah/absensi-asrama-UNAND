import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Empty, ErrorBox, Loading, Modal, PageHeader, StatusPill, useFetch, useToast } from '../../components/ui.jsx';
import { SESI_LABEL, downloadCsv, fmtDate, mapsUrl, monthEnd, monthStart } from '../../utils.js';

const FILTER_KEYS = ['from', 'to', 'gedung_id', 'kamar_id', 'sesi', 'fasil_id', 'q', 'status'];

function useFilters() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'riwayat' ? 'riwayat' : 'rekap';
  const mode = ['gedung', 'penghuni', 'fasil'].includes(params.get('mode')) ? params.get('mode') : 'gedung';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const filters = { from: params.get('from') || monthStart(), to: params.get('to') || monthEnd() };
  FILTER_KEYS.slice(2).forEach(k => { if (params.get(k)) filters[k] = params.get(k); });

  const update = (next, keep = true) => {
    const merged = new URLSearchParams(keep ? params : undefined);
    Object.entries(next).forEach(([k, v]) => (v === '' || v === null || v === undefined ? merged.delete(k) : merged.set(k, v)));
    setParams(merged);
  };
  return { tab, mode, page, filters, update };
}

function FilterBar({ filters, gedungs, fasils, onApply, showMode, mode, riwayat }) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => setDraft(filters), [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps
  const kamars = gedungs.find(g => String(g.id) === String(draft.gedung_id))?.kamar || [];
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v, ...(k === 'gedung_id' ? { kamar_id: '' } : {}) }));

  return (
    <form className="card filter-bar" onSubmit={e => { e.preventDefault(); onApply(draft); }}>
      <label className="form-group"><span className="form-label">Dari</span>
        <input type="date" className="form-input" value={draft.from || ''} onChange={e => set('from', e.target.value)} /></label>
      <label className="form-group"><span className="form-label">Sampai</span>
        <input type="date" className="form-input" value={draft.to || ''} onChange={e => set('to', e.target.value)} /></label>
      <label className="form-group"><span className="form-label">Gedung</span>
        <select className="form-select" value={draft.gedung_id || ''} onChange={e => set('gedung_id', e.target.value)}>
          <option value="">Semua gedung</option>
          {gedungs.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
        </select></label>
      <label className="form-group"><span className="form-label">Kamar</span>
        <select className="form-select" value={draft.kamar_id || ''} disabled={!draft.gedung_id} onChange={e => set('kamar_id', e.target.value)}>
          <option value="">Semua kamar</option>
          {kamars.map(k => <option key={k.id} value={k.id}>{k.no_kamar}</option>)}
        </select></label>
      <label className="form-group"><span className="form-label">Sesi</span>
        <select className="form-select" value={draft.sesi || ''} onChange={e => set('sesi', e.target.value)}>
          <option value="">Semua sesi</option><option value="subuh">Subuh</option><option value="malam">Malam</option>
        </select></label>
      {!riwayat && (
        <label className="form-group"><span className="form-label">Fasil</span>
          <select className="form-select" value={draft.fasil_id || ''} onChange={e => set('fasil_id', e.target.value)}>
            <option value="">Semua fasil</option>
            {fasils.map(f => <option key={f.nim_nip} value={f.nim_nip}>{f.nama}</option>)}
          </select></label>
      )}
      {riwayat && (
        <>
          <label className="form-group"><span className="form-label">Penghuni (nama / NIM)</span>
            <input className="form-input" value={draft.q || ''} placeholder="Cari..." onChange={e => set('q', e.target.value)} /></label>
          <label className="form-group"><span className="form-label">Status</span>
            <select className="form-select" value={draft.status || ''} onChange={e => set('status', e.target.value)}>
              <option value="">Semua status</option><option value="hadir">Hadir</option><option value="terlambat">Terlambat</option>
              <option value="izin">Izin</option><option value="alpa">Alpa</option>
            </select></label>
        </>
      )}
      <div className="filter-actions">
        <button className="btn btn-primary">Terapkan</button>
        <button type="button" className="btn btn-outline" onClick={() => onApply({ from: monthStart(), to: monthEnd() }, true)}>Reset</button>
      </div>
      {showMode && <span className="hidden">{mode}</span>}
    </form>
  );
}

export default function AdminRiwayat() {
  const { tab, mode, page, filters, update } = useFilters();
  const gedung = useFetch(() => api.get('/gedung'), []);
  const users = useFetch(() => api.get('/users', { role: 'fasil' }), []);
  const gedungs = gedung.data?.gedungs || [];
  const fasils = users.data?.users || [];

  const apply = (draft, reset) => {
    const next = { page: '' };
    FILTER_KEYS.forEach(k => { next[k] = reset ? '' : (draft[k] || ''); });
    if (reset) { next.from = ''; next.to = ''; }
    update(next);
  };

  return (
    <>
      <PageHeader title="Riwayat Presensi" subtitle="Rekap dan riwayat detail presensi seluruh asrama." />
      <div className="tabs">
        <button className={`tab ${tab === 'rekap' ? 'active' : ''}`} onClick={() => update({ tab: 'rekap', page: '' })}>Rekap</button>
        <button className={`tab ${tab === 'riwayat' ? 'active' : ''}`} onClick={() => update({ tab: 'riwayat', page: '' })}>Riwayat Detail</button>
      </div>
      <FilterBar key={tab} filters={filters} gedungs={gedungs} fasils={fasils} onApply={apply} riwayat={tab === 'riwayat'} />
      {tab === 'rekap'
        ? <RekapTab filters={filters} mode={mode} update={update} />
        : <RiwayatTab filters={filters} page={page} update={update} />}
    </>
  );
}

function RekapTab({ filters, mode, update }) {
  const query = { ...filters, mode };
  delete query.q; delete query.status;
  const { data, loading, error, reload } = useFetch(() => api.get('/rekap', query), [JSON.stringify(query)]);
  const modes = [['gedung', 'Per Gedung'], ['penghuni', 'Per Penghuni'], ['fasil', 'Per Fasil']];

  const exportCsv = () => downloadCsv(`rekap-${mode}_${filters.from}_${filters.to}.csv`,
    [[mode === 'gedung' ? 'Gedung' : mode === 'fasil' ? 'Fasil' : 'Penghuni', 'Keterangan', 'Hadir', 'Izin', 'Alpa', '% Hadir']].concat(
      data.rows.map(r => [r.nama, r.sub, r.hadir, r.izin, r.alpa, `${r.persen}%`])));

  // Gedung/Fasil → daftar penghuni (sesuai gedung/fasil); Penghuni → riwayat absensi penghuni tsb.
  const open = row => {
    if (mode === 'penghuni') return update({ tab: 'riwayat', page: '', q: row.key });
    update({ mode: 'penghuni', gedung_id: row.filter.gedung_id || '', kamar_id: '', fasil_id: row.filter.fasil_id || '' });
  };
  const gedungNama = filters.gedung_id && data?.rows[0]?.sub?.split(' • ')[1]?.split(' / ')[0];

  return (
    <div className="card">
      <div className="section-head">
        <div className="tabs compact">
          {modes.map(([k, label]) => <button key={k} className={`tab ${mode === k ? 'active' : ''}`} onClick={() => update({ mode: k })}>{label}</button>)}
        </div>
        <button className="btn btn-outline" disabled={!data?.rows.length} onClick={exportCsv}>📥 Ekspor CSV</button>
      </div>
      {mode === 'penghuni' && (filters.gedung_id || filters.fasil_id) && (
        <div className="section-head">
          <strong>Penghuni {gedungNama ? `Gedung ${gedungNama}` : 'terfilter'}</strong>
          <button className="btn btn-outline btn-sm" onClick={() => update({ mode: filters.fasil_id && !filters.gedung_id ? 'fasil' : 'gedung', gedung_id: '', kamar_id: '', fasil_id: '' })}>← Kembali</button>
        </div>
      )}
      <p className="muted small">Periode {fmtDate(filters.from)} – {fmtDate(filters.to)} • {mode === 'penghuni' ? 'klik nama penghuni untuk melihat riwayat absensinya.' : 'klik baris untuk melihat daftar penghuni.'}</p>
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.rows.length ? <Empty>Tidak ada data.</Empty> : (
        <div className="table-wrap">
          <table className="table clickable">
            <thead><tr><th>{mode === 'gedung' ? 'Gedung' : mode === 'fasil' ? 'Fasil' : 'Penghuni'}</th><th className="num">Hadir</th><th className="num">Izin</th><th className="num">Alpa</th><th className="num">% Hadir</th></tr></thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.key} onClick={() => open(r)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && open(r)}>
                  <td><strong>{r.nama}</strong>{r.sub && <div className="muted small">{r.sub}</div>}
                    {mode !== 'penghuni' && <div className="muted small">{r.penghuni} penghuni</div>}</td>
                  <td className="num c-green">{r.hadir}</td><td className="num c-amber">{r.izin}</td><td className="num c-red">{r.alpa}</td>
                  <td className="num"><span className={`pct ${r.persen >= 85 ? 'ok' : 'low'}`}>{r.persen}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RiwayatTab({ filters, page, update }) {
  const toast = useToast();
  const [perPage, setPerPage] = useState(20);
  const query = useMemo(() => ({ ...filters, page, per_page: perPage }), [JSON.stringify(filters), page, perPage]); // eslint-disable-line
  const { data, loading, error, reload } = useFetch(() => api.get('/riwayat', query), [JSON.stringify(query)]);
  const [photo, setPhoto] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  const exportCsv = async () => {
    try { await api.download('/riwayat/export', filters, `riwayat-presensi_${filters.from}_${filters.to}.csv`); }
    catch (err) { toast(err.message, 'error'); }
  };
  const doDelete = async () => {
    try { await api.del(`/presensi/${del.id}`); toast('Data presensi dihapus.'); setDel(null); reload(); }
    catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="card">
      <div className="section-head">
        <span className="muted small">
          {filters.q && <button className="btn btn-outline btn-sm" style={{ marginRight: 8 }} onClick={() => update({ tab: 'rekap', mode: 'penghuni', q: '', page: '' })}>← Kembali ke daftar penghuni</button>}
          {data ? `${data.total} catatan` : ''}
        </span>
        <div className="page-actions">
          <select className="form-select" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); update({ page: '' }); }}>
            {[20, 30, 50].map(n => <option key={n} value={n}>{n} / halaman</option>)}
          </select>
          <button className="btn btn-outline" onClick={exportCsv}>📥 Ekspor CSV (sesuai filter)</button>
        </div>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.rows.length ? <Empty>Tidak ada riwayat untuk filter ini.</Empty> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tanggal</th><th>Jam</th><th>Penghuni</th><th>Gedung / Kamar</th><th>Sesi</th><th>Status</th><th>Foto</th><th>Lokasi</th><th>Fasil</th><th className="num">Aksi</th></tr></thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.tanggal)}</td>
                    <td>{r.jam || '-'}</td>
                    <td><strong>{r.nama}</strong><div className="muted small">{r.nim}</div></td>
                    <td className="small">{r.gedung ? `${r.gedung} / ${r.kamar}` : '-'}</td>
                    <td>{SESI_LABEL[r.sesi]}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td>{r.foto ? <img className="thumb" src={r.foto} alt={`Foto ${r.nama}`} onClick={() => setPhoto(r)} /> : '-'}</td>
                    <td className="small">{r.lat !== null ? (
                      <>{r.jarak !== null ? `${r.jarak} m dari gedung` : 'Titik tidak diketahui'}<br />
                        <a className="link" href={mapsUrl(r.lat, r.lng)} target="_blank" rel="noreferrer">Lihat peta ↗</a></>
                    ) : '-'}</td>
                    <td className="small">{r.fasil || '-'}</td>
                    <td className="num actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setEdit(r)}>Koreksi</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDel(r)}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>‹ Sebelumnya</button>
            <span>Halaman {page} dari {totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => update({ page: page + 1 })}>Berikutnya ›</button>
          </div>
        </>
      )}

      {photo && (
        <Modal title={`${photo.nama} • ${fmtDate(photo.tanggal)} ${photo.jam}`} onClose={() => setPhoto(null)} wide>
          <img className="photo-full" src={photo.foto} alt={`Foto presensi ${photo.nama}`} />
          <p className="muted small">Koordinat: {photo.lat}, {photo.lng} {photo.jarak !== null && `• ${photo.jarak} m dari titik gedung`}</p>
        </Modal>
      )}
      {edit && <CorrectModal row={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); toast('Status berhasil dikoreksi.'); }} />}
      {del && (
        <Modal title="Hapus data presensi?" onClose={() => setDel(null)}>
          <p>Catatan <strong>{del.nama}</strong> — {fmtDate(del.tanggal)}, sesi {SESI_LABEL[del.sesi]} ({del.status}) akan dihapus permanen beserta fotonya.</p>
          <div className="btn-row">
            <button className="btn btn-outline" onClick={() => setDel(null)}>Batal</button>
            <button className="btn btn-danger grow" onClick={doDelete}>Ya, hapus</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CorrectModal({ row, onClose, onDone }) {
  const toast = useToast();
  const [status, setStatus] = useState(row.status);
  const [keterangan, setKeterangan] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try { await api.patch(`/presensi/${row.id}`, { status, keterangan }); onDone(); }
    catch (err) { toast(err.message, 'error'); setBusy(false); }
  };
  return (
    <Modal title="Koreksi Status Presensi" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="small"><strong>{row.nama}</strong> • {fmtDate(row.tanggal)} • Sesi {SESI_LABEL[row.sesi]} • saat ini <StatusPill status={row.status} /></p>
        <label className="form-group"><span className="form-label">Status baru</span>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="hadir">Hadir</option><option value="terlambat">Terlambat</option>
            <option value="izin">Izin</option><option value="alpa">Alpa</option>
          </select></label>
        <label className="form-group"><span className="form-label">Keterangan (wajib)</span>
          <textarea className="form-textarea" required minLength={3} value={keterangan} onChange={e => setKeterangan(e.target.value)}
            placeholder="Alasan koreksi, mis. kamera error / surat izin menyusul" /></label>
        <div className="btn-row">
          <button type="button" className="btn btn-outline" onClick={onClose}>Batal</button>
          <button className="btn btn-primary grow" disabled={busy || status === row.status}>Simpan Koreksi</button>
        </div>
      </form>
    </Modal>
  );
}
