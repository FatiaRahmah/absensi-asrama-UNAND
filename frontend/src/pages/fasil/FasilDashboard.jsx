import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Empty, ErrorBox, Loading, PageHeader, ProgressBar, StatCard, useFetch, useToast } from '../../components/ui.jsx';
import { SESI_LABEL, fmtDate, fmtMinutes } from '../../utils.js';

export default function FasilDashboard() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get('/dashboard/fasil'), []);
  const [sesi, setSesi] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const decide = async (id, status) => {
    setBusyId(id);
    try {
      await api.patch(`/izin/${id}/status`, { status });
      toast(status === 'disetujui' ? 'Izin disetujui.' : 'Izin ditolak.');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const active = sesi || data.fokusSesi;
  const card = data.kartu[active];
  const s = data.sesiSekarang;
  const pending = data.izinPending;

  return (
    <>
      <PageHeader title="Dashboard Fasilitator" subtitle={`Ringkasan ${data.binaan} penghuni binaan Anda hari ini • ${fmtDate(data.tanggal)}`}>
        <button className="btn btn-outline btn-sm" onClick={reload}>↻ Muat ulang</button>
      </PageHeader>

      <div className={`session-banner ${s.aktif ? 'on' : 'off'}`}>
        {s.aktif
          ? <>🟢 <strong>Sesi {s.label} berlangsung</strong> — ditutup dalam {fmtMinutes(s.sisaMenit)}.
            {' '}<strong>{data.belumAbsen.length}</strong> binaan belum absen.</>
          : <>⏱️ Di luar jadwal. Sesi {s.label} dibuka dalam {fmtMinutes(s.bukaDalamMenit)}.
            {' '}Sesi {SESI_LABEL[data.fokusSesi]} terakhir: <strong>{data.belumAbsen.length}</strong> binaan belum tercatat.</>}
      </div>

      <section className={`card prominent ${pending.total ? 'has-pending' : ''}`}>
        <div className="card-head">
          <div>
            <h2>Izin Menunggu Persetujuan</h2>
            <p className="muted small">Satu-satunya tindakan yang menjadi tugas aktif Anda.</p>
          </div>
          <span className={`count-badge ${pending.total ? 'warn' : ''}`}>{pending.total}</span>
        </div>
        {!pending.daftar.length ? <Empty>✅ Tidak ada izin yang menunggu persetujuan.</Empty> : (
          <ul className="approval-list">
            {pending.daftar.map(r => (
              <li key={r.id}>
                <div className="approval-info">
                  <strong>{r.nama}</strong> <span className="muted small">• {r.nim}</span>
                  <div className="small">Tanggal izin: <b>{fmtDate(r.tanggal)}</b> <span className="muted">(diajukan {r.diajukan})</span></div>
                  <div className="muted small">{r.alasan}</div>
                  {r.file_bukti && <a className="link small" href={r.file_bukti} target="_blank" rel="noreferrer">📎 Lihat berkas bukti</a>}
                </div>
                <div className="approval-actions">
                  <button className="btn btn-primary btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, 'disetujui')}>Setujui</button>
                  <button className="btn btn-danger btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, 'ditolak')}>Tolak</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {pending.total > pending.daftar.length && (
          <p className="muted small">Menampilkan {pending.daftar.length} dari {pending.total} pengajuan. Proses beberapa untuk melihat selanjutnya.</p>
        )}
      </section>

      <div className="section-head">
        <h3>Kehadiran Binaan Hari Ini</h3>
        <div className="tabs compact">
          {['subuh', 'malam'].map(k => (
            <button key={k} className={`tab ${active === k ? 'active' : ''}`} onClick={() => setSesi(k)}>{SESI_LABEL[k]}</button>
          ))}
        </div>
      </div>
      <div className="stat-grid">
        <StatCard label="Hadir" value={card.hadir} tone="green" hint={`${card.persen}% dari ${card.total} binaan`} />
        <StatCard label="Izin" value={card.izin} tone="amber" />
        <StatCard label="Alpa" value={card.alpa} tone="red" />
        <StatCard label="Belum Absen" value={card.belum} tone="gray" />
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Perlu Perhatian</h3>
          <p className="muted small">Binaan dengan alpa ≥ 3 kali minggu ini atau 2 sesi berturut-turut.</p>
          {!data.perhatian.length ? <Empty>👍 Tidak ada binaan yang perlu ditindaklanjuti.</Empty> : (
            <ul className="list">
              {data.perhatian.map(p => (
                <li key={p.nim}>
                  <div>
                    <Link className="link" to={`/fasil/rekap/${p.nim}`}><strong>{p.nama}</strong></Link>
                    <div className="muted small">{p.nim}</div>
                  </div>
                  <div className="reason-tags">
                    {p.alpaMinggu >= 3 && <span className="pill alpa">{p.alpaMinggu}× alpa minggu ini</span>}
                    {p.berturut >= 2 && <span className="pill alpa">{p.berturut}× berturut-turut</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3>Kehadiran Bulan Ini</h3>
          <div className="big-percent">{data.bulanIni.persen}%</div>
          <ProgressBar value={data.bulanIni.persen} tone={data.bulanIni.persen >= 85 ? 'green' : 'amber'} />
          <div className="mini-stats">
            <div><b className="c-green">{data.bulanIni.hadir}</b><span>Hadir</span></div>
            <div><b className="c-amber">{data.bulanIni.izin}</b><span>Izin</span></div>
            <div><b className="c-red">{data.bulanIni.alpa}</b><span>Alpa</span></div>
          </div>
          {!!data.belumAbsen.length && (
            <div className="belum-list">
              <div className="muted small">Belum tercatat (sesi {SESI_LABEL[data.fokusSesi]}):</div>
              <div>{data.belumAbsen.slice(0, 8).map(b => <span key={b.nim} className="chip">{b.nama}</span>)}
                {data.belumAbsen.length > 8 && <span className="chip">+{data.belumAbsen.length - 8}</span>}</div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
