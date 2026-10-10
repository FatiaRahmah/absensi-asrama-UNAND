const prisma = require('../config/database');
const { ASRAMA_LOCATIONS, haversineDistance } = require('../utils/geoCheck');
const {
	SESI, num, toDateKey, todayKey, addDays, percent, sessionStatus, focusSession, ensureAlpa
} = require('../utils/attendance');

const HADIR_SQL = "p.status IN ('hadir','terlambat')";
const query = (sql, ...params) => prisma.$queryRawUnsafe(sql, ...params);

function monthRange(dateKey) {
	const [y, m] = dateKey.split('-').map(Number);
	const last = new Date(y, m, 0).getDate();
	const mm = String(m).padStart(2, '0');
	return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

const isDateKey = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

function csvEscape(value) {
	const text = value === null || value === undefined ? '' : String(value);
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function zeroCounts() {
	return { hadir: 0, izin: 0, alpa: 0, belum: 0, total: 0, persen: 0 };
}

/** Hitung kartu hari ini per sesi untuk sekelompok penghuni (semua / binaan). */
async function todayCards(today, fasilNim) {
	const scope = fasilNim ? 'AND u.fasil_id = ?' : '';
	const params = fasilNim ? [fasilNim] : [];
	const [{ total }] = await query(
		`SELECT COUNT(*) AS total FROM \`user\` u WHERE u.role = 'penghuni' AND u.aktif = 1 ${scope}`, ...params
	);
	const rows = await query(
		`SELECT p.sesi, p.status, COUNT(*) AS c FROM presensi p JOIN \`user\` u ON u.nim = p.nim
		 WHERE p.tanggal = ? AND u.role = 'penghuni' AND u.aktif = 1 ${scope} GROUP BY p.sesi, p.status`,
		today, ...params
	);
	const result = { subuh: zeroCounts(), malam: zeroCounts() };
	for (const key of Object.keys(result)) result[key].total = num(total);
	for (const row of rows) {
		const bucket = result[row.sesi];
		if (row.status === 'hadir' || row.status === 'terlambat') bucket.hadir += num(row.c);
		else bucket[row.status] += num(row.c);
	}
	for (const bucket of Object.values(result)) {
		bucket.belum = Math.max(0, bucket.total - bucket.hadir - bucket.izin - bucket.alpa);
		bucket.persen = percent(bucket.hadir, bucket.total);
	}
	return result;
}

async function adminDashboard(ctx) {
	await ensureAlpa();
	const today = todayKey();
	const [master] = await query(
		`SELECT
			(SELECT COUNT(*) FROM \`user\` WHERE role = 'penghuni' AND aktif = 1) AS penghuni,
			(SELECT COUNT(*) FROM \`user\` WHERE role = 'fasil' AND aktif = 1) AS fasil,
			(SELECT COUNT(*) FROM gedung) AS gedung,
			(SELECT COUNT(*) FROM kamar) AS kamar,
			(SELECT COUNT(DISTINCT kamar_id) FROM \`user\` WHERE role = 'penghuni' AND aktif = 1 AND kamar_id IS NOT NULL) AS kamar_terisi`
	);

	const perGedung = (await query(
		`SELECT g.id, g.nama, COUNT(DISTINCT u.nim) AS penghuni,
			COALESCE(SUM(${HADIR_SQL}), 0) AS hadir, COALESCE(SUM(p.status = 'alpa'), 0) AS alpa,
			COALESCE(SUM(p.status = 'izin'), 0) AS izin
		 FROM gedung g
		 LEFT JOIN kamar k ON k.gedung_id = g.id
		 LEFT JOIN \`user\` u ON u.kamar_id = k.id AND u.role = 'penghuni' AND u.aktif = 1
		 LEFT JOIN presensi p ON p.nim = u.nim AND p.tanggal = ?
		 GROUP BY g.id, g.nama ORDER BY g.nama`, today
	)).map(r => ({ id: r.id, nama: r.nama, penghuni: num(r.penghuni), hadir: num(r.hadir), izin: num(r.izin), alpa: num(r.alpa) }));

	const residentRow = r => ({ nim: r.nim, nama: r.nama });
	const tanpaKamar = (await query(
		"SELECT nim, nama FROM `user` WHERE role = 'penghuni' AND aktif = 1 AND kamar_id IS NULL ORDER BY nama"
	)).map(residentRow);
	const tanpaFasil = (await query(
		"SELECT nim, nama FROM `user` WHERE role = 'penghuni' AND aktif = 1 AND fasil_id IS NULL ORDER BY nama"
	)).map(residentRow);

	const kamarRows = (await query(
		`SELECT k.id, k.no_kamar, k.kapasitas, g.nama AS gedung, COUNT(u.nim) AS terisi
		 FROM kamar k JOIN gedung g ON g.id = k.gedung_id
		 LEFT JOIN \`user\` u ON u.kamar_id = k.id AND u.role = 'penghuni' AND u.aktif = 1
		 GROUP BY k.id, k.no_kamar, k.kapasitas, g.nama ORDER BY g.nama, k.no_kamar`
	)).map(r => ({ id: r.id, no_kamar: r.no_kamar, gedung: r.gedung, kapasitas: num(r.kapasitas), terisi: num(r.terisi) }));

	const izinTertunda = (await query(
		`SELECT i.id, i.nim, u.nama, DATE_FORMAT(i.tanggal, '%Y-%m-%d') AS tanggal,
			DATEDIFF(NOW(), i.created_at) AS hari, f.nama AS fasil
		 FROM izin i JOIN \`user\` u ON u.nim = i.nim LEFT JOIN \`user\` f ON f.nim = u.fasil_id
		 WHERE i.status_izin = 'pending' AND i.created_at < (NOW() - INTERVAL 2 DAY)
		 ORDER BY i.created_at`
	)).map(r => ({ ...r, hari: num(r.hari) }));

	const fasilBeban = (await query(
		`SELECT f.nim, f.nama, COUNT(b.nim) AS binaan
		 FROM \`user\` f LEFT JOIN \`user\` b ON b.fasil_id = f.nim AND b.role = 'penghuni' AND b.aktif = 1
		 WHERE f.role = 'fasil' AND f.aktif = 1 GROUP BY f.nim, f.nama ORDER BY binaan DESC, f.nama`
	)).map(r => ({ nim: r.nim, nama: r.nama, binaan: num(r.binaan) }));
	const counts = fasilBeban.map(f => f.binaan);
	const selisih = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;

	const from = addDays(today, -6);
	const trendRows = await query(
		`SELECT DATE_FORMAT(p.tanggal, '%Y-%m-%d') AS tanggal, SUM(${HADIR_SQL}) AS hadir, COUNT(*) AS total
		 FROM presensi p JOIN \`user\` u ON u.nim = p.nim
		 WHERE p.tanggal BETWEEN ? AND ? AND u.role = 'penghuni' GROUP BY p.tanggal`, from, today
	);
	const trendMap = new Map(trendRows.map(r => [r.tanggal, r]));
	const tren = Array.from({ length: 7 }, (_, i) => {
		const tanggal = addDays(from, i);
		const row = trendMap.get(tanggal);
		return { tanggal, persen: row ? percent(num(row.hadir), num(row.total)) : null };
	});

	ctx.body = {
		tanggal: today,
		master: {
			penghuni: num(master.penghuni), fasil: num(master.fasil), gedung: num(master.gedung),
			kamar: num(master.kamar), kamarTerisi: num(master.kamar_terisi)
		},
		sesiHariIni: await todayCards(today),
		sesiSekarang: sessionStatus(),
		perGedung,
		tindakLanjut: {
			tanpaKamar,
			tanpaFasil,
			kamarKosong: kamarRows.filter(k => k.terisi === 0),
			kamarPenuh: kamarRows.filter(k => k.terisi >= k.kapasitas),
			izinTertunda,
			fasilTimpang: { daftar: fasilBeban, selisih }
		},
		tren
	};
}

async function fasilDashboard(ctx) {
	await ensureAlpa();
	const me = ctx.state.user.nim;
	const today = todayKey();
	const focus = focusSession();

	const kartu = await todayCards(today, me);
	const [{ total: binaanTotal }] = await query(
		"SELECT COUNT(*) AS total FROM `user` WHERE role = 'penghuni' AND aktif = 1 AND fasil_id = ?", me
	);

	const belumAbsen = (await query(
		`SELECT u.nim, u.nama FROM \`user\` u
		 WHERE u.role = 'penghuni' AND u.aktif = 1 AND u.fasil_id = ?
		   AND NOT EXISTS (SELECT 1 FROM presensi p WHERE p.nim = u.nim AND p.tanggal = ? AND p.sesi = ?)
		 ORDER BY u.nama`, me, today, focus
	));

	const pendingTotal = num((await query(
		`SELECT COUNT(*) AS c FROM izin i JOIN \`user\` u ON u.nim = i.nim
		 WHERE i.status_izin = 'pending' AND u.fasil_id = ?`, me
	))[0].c);
	const izinPending = await query(
		`SELECT i.id, i.nim, u.nama, DATE_FORMAT(i.tanggal, '%Y-%m-%d') AS tanggal, i.alasan, i.file_bukti,
			DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i') AS diajukan
		 FROM izin i JOIN \`user\` u ON u.nim = i.nim
		 WHERE i.status_izin = 'pending' AND u.fasil_id = ?
		 ORDER BY i.created_at LIMIT 5`, me
	);

	const since = addDays(today, -14);
	const history = await query(
		`SELECT p.nim, u.nama, DATE_FORMAT(p.tanggal, '%Y-%m-%d') AS tanggal, p.sesi, p.status
		 FROM presensi p JOIN \`user\` u ON u.nim = p.nim
		 WHERE u.fasil_id = ? AND u.role = 'penghuni' AND u.aktif = 1 AND p.tanggal >= ?
		 ORDER BY p.tanggal, FIELD(p.sesi, 'subuh', 'malam')`, me, since
	);
	const now = new Date();
	const monday = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)));
	const byNim = new Map();
	for (const row of history) {
		if (!byNim.has(row.nim)) byNim.set(row.nim, { nim: row.nim, nama: row.nama, rows: [] });
		byNim.get(row.nim).rows.push(row);
	}
	const perhatian = [];
	for (const entry of byNim.values()) {
		const alpaMinggu = entry.rows.filter(r => r.status === 'alpa' && r.tanggal >= monday).length;
		let berturut = 0;
		for (let i = entry.rows.length - 1; i >= 0 && entry.rows[i].status === 'alpa'; i--) berturut++;
		if (alpaMinggu >= 3 || berturut >= 2) perhatian.push({ nim: entry.nim, nama: entry.nama, alpaMinggu, berturut });
	}
	perhatian.sort((a, b) => b.alpaMinggu - a.alpaMinggu || b.berturut - a.berturut);

	const month = monthRange(today);
	const monthRows = await query(
		`SELECT p.status, COUNT(*) AS c FROM presensi p JOIN \`user\` u ON u.nim = p.nim
		 WHERE u.fasil_id = ? AND u.role = 'penghuni' AND p.tanggal BETWEEN ? AND ? GROUP BY p.status`,
		me, month.from, today
	);
	const bulan = { hadir: 0, izin: 0, alpa: 0 };
	for (const row of monthRows) {
		if (row.status === 'izin') bulan.izin += num(row.c);
		else if (row.status === 'alpa') bulan.alpa += num(row.c);
		else bulan.hadir += num(row.c);
	}
	const bulanTotal = bulan.hadir + bulan.izin + bulan.alpa;

	ctx.body = {
		tanggal: today,
		binaan: num(binaanTotal),
		fokusSesi: focus,
		kartu,
		sesiSekarang: sessionStatus(),
		belumAbsen,
		izinPending: { total: pendingTotal, daftar: izinPending },
		perhatian,
		bulanIni: { ...bulan, total: bulanTotal, persen: percent(bulan.hadir, bulanTotal) }
	};
}

/* ------------------------------ REKAP ------------------------------ */

async function rekap(ctx) {
	await ensureAlpa();
	const user = ctx.state.user;
	const q = ctx.query;
	const month = monthRange(todayKey());
	const from = isDateKey(q.from) ? q.from : month.from;
	const to = isDateKey(q.to) ? q.to : month.to;
	if (from > to) ctx.throw(400, 'Rentang tanggal tidak valid');
	const sesi = SESI[q.sesi] ? q.sesi : null;
	const mode = user.role === 'fasil' ? 'penghuni' : (['gedung', 'penghuni', 'fasil'].includes(q.mode) ? q.mode : 'gedung');

	const joinParams = [from, to];
	let join = 'p.nim = u.nim AND p.tanggal BETWEEN ? AND ?';
	if (sesi) { join += ' AND p.sesi = ?'; joinParams.push(sesi); }

	let where = "u.role = 'penghuni'";
	const whereParams = [];
	if (user.role === 'fasil') { where += ' AND u.fasil_id = ?'; whereParams.push(user.nim); }
	else {
		if (q.gedung_id) { where += ' AND g.id = ?'; whereParams.push(Number(q.gedung_id)); }
		if (q.kamar_id) { where += ' AND k.id = ?'; whereParams.push(Number(q.kamar_id)); }
		if (q.fasil_id) { where += ' AND u.fasil_id = ?'; whereParams.push(String(q.fasil_id)); }
	}

	const rows = await query(
		`SELECT u.nim, u.nama, u.fasil_id, f.nama AS fasil_nama, g.id AS gedung_id, g.nama AS gedung,
			k.id AS kamar_id, k.no_kamar,
			COALESCE(SUM(${HADIR_SQL}), 0) AS hadir, COALESCE(SUM(p.status = 'izin'), 0) AS izin,
			COALESCE(SUM(p.status = 'alpa'), 0) AS alpa
		 FROM \`user\` u
		 LEFT JOIN kamar k ON k.id = u.kamar_id
		 LEFT JOIN gedung g ON g.id = k.gedung_id
		 LEFT JOIN \`user\` f ON f.nim = u.fasil_id
		 LEFT JOIN presensi p ON ${join}
		 WHERE ${where}
		 GROUP BY u.nim, u.nama, u.fasil_id, f.nama, g.id, g.nama, k.id, k.no_kamar
		 ORDER BY u.nama`,
		...joinParams, ...whereParams
	);

	const groups = new Map();
	for (const r of rows) {
		let key, nama, sub, filter;
		if (mode === 'penghuni') {
			key = r.nim; nama = r.nama;
			sub = user.role === 'fasil' ? r.nim : `${r.nim} • ${r.gedung ? `${r.gedung} / ${r.no_kamar}` : 'Belum ada kamar'}`;
			filter = { q: r.nim };
		} else if (mode === 'fasil') {
			key = r.fasil_id || '-'; nama = r.fasil_nama || 'Belum punya fasil'; sub = r.fasil_id || '';
			filter = r.fasil_id ? { fasil_id: r.fasil_id } : {};
		} else {
			key = r.gedung_id || 0; nama = r.gedung || 'Belum punya kamar'; sub = '';
			filter = r.gedung_id ? { gedung_id: r.gedung_id } : {};
		}
		if (!groups.has(key)) groups.set(key, { key, nama, sub, filter, penghuni: 0, hadir: 0, izin: 0, alpa: 0 });
		const g = groups.get(key);
		g.penghuni += 1;
		g.hadir += num(r.hadir); g.izin += num(r.izin); g.alpa += num(r.alpa);
	}
	const data = [...groups.values()].map(g => {
		const total = g.hadir + g.izin + g.alpa;
		return { ...g, total, persen: percent(g.hadir, total) };
	});
	data.sort((a, b) => a.nama.localeCompare(b.nama));
	ctx.body = { mode, from, to, sesi, rows: data };
}

/* ----------------------------- RIWAYAT ----------------------------- */

function riwayatQuery(q) {
	const month = monthRange(todayKey());
	const from = isDateKey(q.from) ? q.from : month.from;
	const to = isDateKey(q.to) ? q.to : month.to;
	let where = 'p.tanggal BETWEEN ? AND ?';
	const params = [from, to];
	if (q.gedung_id) { where += ' AND g.id = ?'; params.push(Number(q.gedung_id)); }
	if (q.kamar_id) { where += ' AND k.id = ?'; params.push(Number(q.kamar_id)); }
	if (q.fasil_id) { where += ' AND u.fasil_id = ?'; params.push(String(q.fasil_id)); }
	if (SESI[q.sesi]) { where += ' AND p.sesi = ?'; params.push(q.sesi); }
	if (['hadir', 'izin', 'alpa', 'terlambat'].includes(q.status)) { where += ' AND p.status = ?'; params.push(q.status); }
	if (q.q && String(q.q).trim()) {
		where += ' AND (u.nama LIKE ? OR u.nim LIKE ?)';
		params.push(`%${String(q.q).trim()}%`, `%${String(q.q).trim()}%`);
	}
	const base = `FROM presensi p
		JOIN \`user\` u ON u.nim = p.nim
		LEFT JOIN kamar k ON k.id = u.kamar_id
		LEFT JOIN gedung g ON g.id = k.gedung_id
		LEFT JOIN \`user\` f ON f.nim = u.fasil_id
		WHERE ${where}`;
	return { base, params };
}

const RIWAYAT_COLUMNS = `p.id, DATE_FORMAT(p.tanggal, '%Y-%m-%d') AS tanggal, TIME_FORMAT(p.jam, '%H:%i:%s') AS jam,
	p.sesi, p.status, p.foto_wajah, p.lat, p.\`long\` AS lng, p.keterangan, u.nim, u.nama,
	g.id AS gedung_id, g.nama AS gedung, k.id AS kamar_id, k.no_kamar, f.nim AS fasil_nim, f.nama AS fasil_nama`;
const RIWAYAT_ORDER = 'ORDER BY p.tanggal DESC, p.jam DESC, p.id DESC';

function mapRiwayat(r) {
	const hasProof = r.status === 'hadir' || r.status === 'terlambat';
	const lat = hasProof && r.lat !== null ? Number(r.lat) : null;
	const lng = hasProof && r.lng !== null ? Number(r.lng) : null;
	let jarak = null;
	const point = ASRAMA_LOCATIONS.find(a => a.nama === r.gedung);
	if (lat !== null && lng !== null && point) jarak = Math.round(haversineDistance(lat, lng, point.lat, point.lng));
	return {
		id: r.id, tanggal: r.tanggal, jam: hasProof ? r.jam : null, sesi: r.sesi, status: r.status,
		nim: r.nim, nama: r.nama, gedung: r.gedung, kamar: r.no_kamar, fasil: r.fasil_nama,
		foto: hasProof ? r.foto_wajah : null, lat, lng, jarak, keterangan: r.keterangan
	};
}

async function riwayat(ctx) {
	await ensureAlpa();
	const perPage = Math.min(50, Math.max(20, Number(ctx.query.per_page) || 20));
	const page = Math.max(1, Number(ctx.query.page) || 1);
	const { base, params } = riwayatQuery(ctx.query);
	const [{ total }] = await query(`SELECT COUNT(*) AS total ${base}`, ...params);
	const rows = await query(
		`SELECT ${RIWAYAT_COLUMNS} ${base} ${RIWAYAT_ORDER} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`, ...params
	);
	ctx.body = { rows: rows.map(mapRiwayat), total: num(total), page, perPage };
}

async function riwayatExport(ctx) {
	const { base, params } = riwayatQuery(ctx.query);
	const rows = (await query(`SELECT ${RIWAYAT_COLUMNS} ${base} ${RIWAYAT_ORDER} LIMIT 20000`, ...params)).map(mapRiwayat);
	const header = ['Tanggal', 'Jam', 'NIM', 'Nama', 'Gedung', 'Kamar', 'Sesi', 'Status', 'Latitude', 'Longitude', 'Jarak (m)', 'Fasil', 'Keterangan'];
	const lines = [header.join(',')].concat(rows.map(r => [
		r.tanggal, r.jam, r.nim, r.nama, r.gedung, r.kamar, r.sesi, r.status, r.lat, r.lng, r.jarak, r.fasil, r.keterangan
	].map(csvEscape).join(',')));
	ctx.set('Content-Disposition', 'attachment; filename="riwayat-presensi.csv"');
	ctx.type = 'text/csv; charset=utf-8';
	ctx.body = `\uFEFF${lines.join('\r\n')}`;
}

/* ------------------------- KALENDER BINAAN ------------------------- */

async function kalenderBinaan(ctx) {
	const { nim } = ctx.params;
	const user = ctx.state.user;
	const [resident] = await query(
		"SELECT nim, nama, fasil_id FROM `user` WHERE nim = ? AND role = 'penghuni' LIMIT 1", nim
	);
	if (!resident) ctx.throw(404, 'Penghuni tidak ditemukan');
	if (user.role === 'fasil' && resident.fasil_id !== user.nim) ctx.throw(403, 'Penghuni ini bukan binaan Anda');

	const bulan = /^\d{4}-\d{2}$/.test(ctx.query.bulan || '') ? ctx.query.bulan : todayKey().slice(0, 7);
	const range = monthRange(`${bulan}-01`);
	const rows = await query(
		`SELECT p.id, DATE_FORMAT(p.tanggal, '%Y-%m-%d') AS tanggal, p.sesi, p.status, p.keterangan
		 FROM presensi p WHERE p.nim = ? AND p.tanggal BETWEEN ? AND ? ORDER BY p.tanggal`,
		nim, range.from, range.to
	);
	const hari = {};
	const ringkasan = { hadir: 0, izin: 0, alpa: 0 };
	for (const row of rows) {
		hari[row.tanggal] = hari[row.tanggal] || {};
		hari[row.tanggal][row.sesi] = { id: row.id, status: row.status, keterangan: row.keterangan };
		if (row.status === 'izin') ringkasan.izin++;
		else if (row.status === 'alpa') ringkasan.alpa++;
		else ringkasan.hadir++;
	}
	const izin = await query(
		`SELECT id, DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal, alasan, file_bukti, status_izin,
			DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS diajukan
		 FROM izin WHERE nim = ? ORDER BY tanggal DESC, id DESC`, nim
	);
	ctx.body = {
		penghuni: { nim: resident.nim, nama: resident.nama },
		bulan, hari, ringkasan,
		koreksiFasil: process.env.FASIL_KOREKSI_ENABLED !== 'false',
		izin
	};
}

module.exports = { adminDashboard, fasilDashboard, rekap, riwayat, riwayatExport, kalenderBinaan };
