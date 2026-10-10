import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { Empty, ErrorBox, Loading, PageHeader, useFetch } from '../../components/ui.jsx';
import { downloadCsv, fmtDate, monthEnd, monthStart } from '../../utils.js';

export default function FasilRekap() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({ from: monthStart(), to: monthEnd(), sesi: '' });
  const { data, loading, error, reload } = useFetch(() => api.get('/rekap', filter), [filter.from, filter.to, filter.sesi]);

  const exportCsv = () => {
    const rows = [['Nama', 'NIM', 'Hadir', 'Izin', 'Alpa', '% Hadir']].concat(
      data.rows.map(r => [r.nama, r.key, r.hadir, r.izin, r.alpa, `${r.persen}%`])
    );
    downloadCsv(`rekap-binaan_${filter.from}_${filter.to}.csv`, rows);
  };

  const open = nim => navigate(`/fasil/rekap/${nim}?bulan=${filter.from.slice(0, 7)}`);

  return (
    <>
      <PageHeader title="Rekap Binaan" subtitle="Rekap kehadiran penghuni binaan Anda. Klik baris untuk melihat kalender penghuni.">
        <button className="btn btn-outline" disabled={!data?.rows.length} onClick={exportCsv}>📥 Ekspor CSV</button>
      </PageHeader>

      <div className="card filter-bar">
        <label className="form-group"><span className="form-label">Dari</span>
          <input type="date" className="form-input" value={filter.from} max={filter.to} onChange={e => setFilter({ ...filter, from: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Sampai</span>
          <input type="date" className="form-input" value={filter.to} min={filter.from} onChange={e => setFilter({ ...filter, to: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Sesi</span>
          <select className="form-select" value={filter.sesi} onChange={e => setFilter({ ...filter, sesi: e.target.value })}>
            <option value="">Semua sesi</option><option value="subuh">Subuh</option><option value="malam">Malam</option>
          </select></label>
        <button className="btn btn-outline" onClick={() => setFilter({ from: monthStart(), to: monthEnd(), sesi: '' })}>Bulan ini</button>
      </div>

      <div className="card">
        <p className="muted small">Periode {fmtDate(filter.from)} – {fmtDate(filter.to)}</p>
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> :
          !data.rows.length ? <Empty>Anda belum memiliki penghuni binaan.</Empty> : (
            <div className="table-wrap">
              <table className="table clickable">
                <thead><tr><th>Nama</th><th>NIM</th><th className="num">Hadir</th><th className="num">Izin</th><th className="num">Alpa</th><th className="num">% Hadir</th></tr></thead>
                <tbody>
                  {data.rows.map(r => (
                    <tr key={r.key} onClick={() => open(r.key)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && open(r.key)}>
                      <td><strong>{r.nama}</strong></td>
                      <td>{r.key}</td>
                      <td className="num c-green">{r.hadir}</td>
                      <td className="num c-amber">{r.izin}</td>
                      <td className="num c-red">{r.alpa}</td>
                      <td className="num"><span className={`pct ${r.persen >= 85 ? 'ok' : 'low'}`}>{r.persen}%</span></td>
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
