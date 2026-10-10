const prisma = require('../config/database');

const SESI = {
	subuh: { label: 'Subuh', start: 240, end: 360, endTime: '06:00:00' },
	malam: { label: 'Malam', start: 1080, end: 1230, endTime: '20:30:00' }
};

const num = value => (value === null || value === undefined ? 0 : Number(value));
const pad = value => String(value).padStart(2, '0');
const toDateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayKey = () => toDateKey(new Date());
const minutesOf = date => date.getHours() * 60 + date.getMinutes();

function addDays(dateKey, days) {
	const [y, m, d] = dateKey.split('-').map(Number);
	return toDateKey(new Date(y, m - 1, d + days));
}

function percent(part, total) {
	return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

/** Status sesi saat ini: sedang berjalan atau berapa menit lagi sesi berikutnya dibuka. */
function sessionStatus(now = new Date()) {
	const minutes = minutesOf(now);
	for (const [key, s] of Object.entries(SESI)) {
		if (minutes >= s.start && minutes <= s.end) {
			return { aktif: true, key, label: s.label, sisaMenit: s.end - minutes };
		}
	}
	const upcoming = minutes < SESI.subuh.start ? 'subuh' : minutes < SESI.malam.start ? 'malam' : 'subuh';
	const target = SESI[upcoming].start + (minutes > SESI.malam.end ? 1440 : 0);
	return { aktif: false, key: upcoming, label: SESI[upcoming].label, bukaDalamMenit: target - minutes };
}

/** Sesi yang dipakai sebagai default tampilan: sesi aktif, atau sesi terakhir yang sudah berakhir hari ini. */
function focusSession(now = new Date()) {
	const minutes = minutesOf(now);
	if (minutes >= SESI.malam.start) return 'malam';
	if (minutes >= SESI.subuh.start) return 'subuh';
	return 'malam';
}

/**
 * Membuat catatan "alpa" otomatis untuk penghuni aktif yang tidak presensi dan tidak
 * punya izin pada sesi hari ini yang sudah berakhir. Aman dijalankan berulang (idempoten).
 */
async function ensureAlpa(now = new Date()) {
	const today = toDateKey(now);
	const minutes = minutesOf(now);
	for (const [key, s] of Object.entries(SESI)) {
		if (minutes <= s.end) continue;
		await prisma.$executeRawUnsafe(
			`INSERT INTO presensi (nim, tanggal, jam, waktu, status, sesi, keterangan)
			 SELECT u.nim, ?, ?, ?, 'alpa', ?, 'Otomatis: tidak melakukan presensi'
			 FROM \`user\` u
			 WHERE u.role = 'penghuni' AND u.aktif = 1
			   AND NOT EXISTS (SELECT 1 FROM presensi p WHERE p.nim = u.nim AND p.tanggal = ? AND p.sesi = ?)`,
			today, s.endTime, `${today} ${s.endTime}`, key, today, key
		);
	}
}

/** Terapkan izin yang disetujui: alpa pada tanggal itu menjadi izin, sesi kosong diisi status izin. */
async function applyIzin(nim, tanggal, alasan) {
	const keterangan = `Izin disetujui: ${alasan}`.slice(0, 500);
	for (const [key, s] of Object.entries(SESI)) {
		const updated = await prisma.$executeRawUnsafe(
			`UPDATE presensi SET status = 'izin', keterangan = ?, foto_wajah = NULL, lat = NULL, \`long\` = NULL
			 WHERE nim = ? AND tanggal = ? AND sesi = ? AND status = 'alpa'`,
			keterangan, nim, tanggal, key
		);
		if (updated) continue;
		await prisma.$executeRawUnsafe(
			`INSERT INTO presensi (nim, tanggal, jam, waktu, status, sesi, keterangan)
			 SELECT ?, ?, ?, ?, 'izin', ?, ?
			 WHERE NOT EXISTS (SELECT 1 FROM presensi WHERE nim = ? AND tanggal = ? AND sesi = ?)`,
			nim, tanggal, s.endTime, `${tanggal} ${s.endTime}`, key, keterangan, nim, tanggal, key
		);
	}
}

module.exports = {
	SESI, num, toDateKey, todayKey, addDays, percent, sessionStatus, focusSession, ensureAlpa, applyIzin
};
