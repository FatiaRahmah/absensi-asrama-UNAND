import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import LineChart from '../../components/LineChart.jsx';
import { Empty, ErrorBox, Loading, PageHeader, ProgressBar, StatCard, useFetch } from '../../components/ui.jsx';
import { fmtDate, fmtMinutes } from '../../utils.js';

function SessionCard({ title, data }) {
  return (
    <div className="card">
      <div className="card-head"><h3>Sesi {title}</h3><span className="big-percent sm">{data.persen}%</span></div>
      <ProgressBar value={data.persen} tone={data.persen >= 85 ? 'green' : 'amber'} />
      <div className="mini-stats four">
        <div><b className="c-green">{data.hadir}</b><span>Hadir</span></div>
        <div><b className="c-amber">{data.izin}</b><span>Izin</span></div>
        <div><b className="c-red">{data.alpa}</b><span>Alpa</span></div>
        <div><b>{data.belum}</b><span>Belum</span></div>
      </div>
      <div className="muted small">Dari {data.total} penghuni aktif • {data.total ? Math.round((data.izin / data.total) * 100) : 0}% izin • {data.total ? Math.round((data.alpa / data.total) * 100) : 0}% alpa</div>
    </div>
  );
}

function TaskGroup({ title, tone, items, render, empty }) {
  return (
    <div className="task-group">
      <div className="task-title"><span>{title}</span><span className={`count-badge ${items.length ? tone : ''}`}>{items.length}</span></div>
      {!items.length ? <div className="muted small">{empty}</div> : (
        <ul className="task-list">
          {items.slice(0, 5).map(render)}
          {items.length > 5 && <li className="muted small">+{items.length - 5} lainnya</li>}
        </ul>
      )}
    </div>
  );
}

export default function AdminMonitoring() {
  const { data, loading, error, reload } = useFetch(() => api.get('/dashboard/admin'), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const { master, sesiHariIni, sesiSekarang: s, perGedung, tindakLanjut: t, tren } = data;
  const occupancy = master.kamar ? Math.round((master.kamarTerisi / master.kamar) * 100) : 0;
  const totalTasks = t.tanpaKamar.length + t.tanpaFasil.length + t.izinTertunda.length;

  return (
    <>
      <PageHeader title="Monitoring Asrama" subtitle={`Kondisi seluruh asrama hari ini • ${fmtDate(data.tanggal)}`}>
        <button className="btn btn-outline btn-sm" onClick={reload}>↻ Muat ulang</button>
      </PageHeader>

      <div className={`session-banner ${s.aktif ? 'on' : 'off'}`}>
        {s.aktif
          ? <>🟢 <strong>Sesi {s.label} sedang berlangsung</strong> — ditutup dalam {fmtMinutes(s.sisaMenit)}</>
          : <>⏱️ Tidak ada sesi berjalan. Sesi <strong>{s.label}</strong> dibuka dalam {fmtMinutes(s.bukaDalamMenit)}</>}
      </div>

      <div className="stat-grid">
        <StatCard label="Penghuni Aktif" value={master.penghuni} tone="green" />
        <StatCard label="Fasilitator" value={master.fasil} tone="blue" />
        <StatCard label="Gedung" value={master.gedung} tone="gray" />
        <StatCard label="Kamar Terisi" value={`${master.kamarTerisi}/${master.kamar}`} tone="amber" hint={`${occupancy}% terisi`} />
      </div>

      <div className="grid-2">
        <SessionCard title="Subuh" data={sesiHariIni.subuh} />
        <SessionCard title="Malam" data={sesiHariIni.malam} />
      </div>

      <div className="grid-2 wide-left">
        <section className="card">
          <h3>Rekap per Gedung Hari Ini</h3>
          {!perGedung.length ? <Empty>Belum ada gedung.</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Gedung</th><th className="num">Penghuni</th><th className="num">Hadir</th><th className="num">Alpa</th></tr></thead>
                <tbody>
                  {perGedung.map(g => (
                    <tr key={g.id}>
                      <td><strong>{g.nama}</strong></td>
                      <td className="num">{g.penghuni}</td>
                      <td className="num c-green">{g.hadir}</td>
                      <td className={`num ${g.alpa ? 'c-red strong' : ''}`}>{g.alpa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small">Jumlah catatan sesi (subuh + malam) hari ini.</p>
        </section>

        <section className="card">
          <div className="card-head"><h3>Perlu Ditindaklanjuti</h3><span className={`count-badge ${totalTasks ? 'warn' : ''}`}>{totalTasks}</span></div>
          <TaskGroup title="Penghuni belum punya kamar" tone="warn" items={t.tanpaKamar} empty="Semua penghuni sudah punya kamar."
            render={p => <li key={p.nim}>{p.nama} <span className="muted small">{p.nim}</span></li>} />
          <TaskGroup title="Penghuni belum punya fasil" tone="warn" items={t.tanpaFasil} empty="Semua penghuni sudah punya fasil."
            render={p => <li key={p.nim}>{p.nama} <span className="muted small">{p.nim}</span></li>} />
          <TaskGroup title="Izin pending > 2 hari" tone="danger" items={t.izinTertunda} empty="Tidak ada izin menggantung."
            render={i => <li key={i.id}>{i.nama} <span className="muted small">{i.hari} hari • fasil: {i.fasil || 'belum ada'}</span></li>} />
          <TaskGroup title="Kamar kosong" tone="info" items={t.kamarKosong} empty="Tidak ada kamar kosong."
            render={k => <li key={k.id}>{k.gedung} / {k.no_kamar}</li>} />
          <TaskGroup title="Kamar penuh" tone="info" items={t.kamarPenuh} empty="Tidak ada kamar penuh."
            render={k => <li key={k.id}>{k.gedung} / {k.no_kamar} <span className="muted small">{k.terisi}/{k.kapasitas}</span></li>} />
          <div className="task-group">
            <div className="task-title"><span>Beban binaan per fasil</span>
              <span className={`count-badge ${t.fasilTimpang.selisih > 5 ? 'warn' : ''}`}>Δ {t.fasilTimpang.selisih}</span></div>
            {!t.fasilTimpang.daftar.length ? <div className="muted small">Belum ada fasil.</div> : (
              <ul className="task-list">
                {t.fasilTimpang.daftar.slice(0, 5).map(f => (
                  <li key={f.nim}>{f.nama} <span className="muted small">{f.binaan} binaan</span></li>
                ))}
              </ul>
            )}
          </div>
          {totalTasks > 0 && <Link className="link small" to="/admin/pengguna">Buka Manajemen Pengguna →</Link>}
        </section>
      </div>

      <section className="card">
        <h3>Tren Kehadiran 7 Hari</h3>
        <LineChart points={tren} />
      </section>
    </>
  );
}
