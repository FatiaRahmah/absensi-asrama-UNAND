const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const pad = n => String(n).padStart(2, '0');
export const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dateKey(new Date());
export const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
export const monthEnd = () => { const d = new Date(); return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };

export function fmtDate(key) {
  if (!key) return '-';
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function fmtDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtShort(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export const STATUS_LABEL = { hadir: 'Hadir', terlambat: 'Terlambat', izin: 'Izin', alpa: 'Alpa', pending: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };
export const SESI_LABEL = { subuh: 'Subuh', malam: 'Malam' };

export const fileUrl = path => (path ? path : '#');
export const mapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

export function fmtMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
}
