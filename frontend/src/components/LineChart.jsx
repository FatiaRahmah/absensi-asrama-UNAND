import { fmtShort } from '../utils.js';

/** Line chart SVG sederhana: persentase kehadiran 7 hari (0-100). */
export default function LineChart({ points }) {
  const W = 640, H = 220, L = 38, R = 16, T = 16, B = 34;
  const innerW = W - L - R, innerH = H - T - B;
  const x = i => L + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const y = v => T + innerH - (innerH * v) / 100;
  const valid = points.map((p, i) => ({ ...p, i })).filter(p => p.persen !== null);
  const path = valid.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.persen)}`).join(' ');
  const area = valid.length > 1
    ? `${path} L${x(valid[valid.length - 1].i)},${y(0)} L${x(valid[0].i)},${y(0)} Z` : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="line-chart" role="img" aria-label="Tren kehadiran 7 hari">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b7a48" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0b7a48" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e5e7eb" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{v}%</text>
        </g>
      ))}
      {area && <path d={area} fill="url(#trendFill)" />}
      {path && <path d={path} fill="none" stroke="#0b7a48" strokeWidth="2.5" strokeLinejoin="round" />}
      {valid.map(p => (
        <g key={p.tanggal}>
          <circle cx={x(p.i)} cy={y(p.persen)} r="4.5" fill="#fff" stroke="#0b7a48" strokeWidth="2.5" />
          <text x={x(p.i)} y={y(p.persen) - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#065f3a">{p.persen}%</text>
        </g>
      ))}
      {points.map((p, i) => (
        <text key={p.tanggal} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="#6b7280">{fmtShort(p.tanggal)}</text>
      ))}
    </svg>
  );
}
