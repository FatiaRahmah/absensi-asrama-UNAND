const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const prisma = require('../config/database');
const { checkAsramaRadius } = require('../utils/geoCheck');
const { SESI, ensureAlpa } = require('../utils/attendance');

async function list(ctx) {
	await ensureAlpa();
	const { role, nim } = ctx.state.user;
	let where = '1 = 1';
	const params = [];
	if (role === 'penghuni') { where = 'p.nim = ?'; params.push(nim); }
	else if (role === 'fasil') { where = 'u.fasil_id = ?'; params.push(nim); }
	const limit = role === 'penghuni' ? 'LIMIT 500' : 'LIMIT 200';
	const records = await prisma.$queryRawUnsafe(
		`SELECT p.id, p.nim, DATE_FORMAT(p.tanggal, '%Y-%m-%d') AS tanggal, TIME_FORMAT(p.jam, '%H:%i:%s') AS jam,
			p.waktu, p.lat, p.\`long\`, p.foto_wajah, p.status, p.sesi, p.keterangan,
			u.nama, u.email, u.kamar_id, k.no_kamar, k.lantai, g.nama AS nama_gedung
		 FROM presensi p
		 JOIN \`user\` u ON u.nim = p.nim
		 LEFT JOIN kamar k ON k.id = u.kamar_id
		 LEFT JOIN gedung g ON g.id = k.gedung_id
		 WHERE ${where}
		 ORDER BY p.tanggal DESC, p.jam DESC, p.id DESC ${limit}`, ...params
	);
	const hasProof = record => record.status === 'hadir' || record.status === 'terlambat';
	ctx.body = {
		records: records.map(record => ({
			id: record.id,
			nim: record.nim,
			jenis_presensi: record.sesi,
			tanggal: record.tanggal,
			jam: hasProof(record) ? record.jam : null,
			waktu_presensi: record.waktu,
			lat: hasProof(record) && record.lat !== null ? Number(record.lat) : null,
			long: hasProof(record) && record.long !== null ? Number(record.long) : null,
			foto_wajah: hasProof(record) ? record.foto_wajah : null,
			status: record.status,
			keterangan: record.keterangan,
			user: {
				id: record.nim,
				nim_nip: record.nim,
				nama: record.nama,
				email: record.email,
				kamar: record.kamar_id === null ? null : {
					no_kamar: record.no_kamar,
					lantai: record.lantai,
					gedung: { nama_gedung: record.nama_gedung }
				}
			}
		}))
	};
}

async function create(ctx) {
	const { jenis_presensi, lat, long, foto } = ctx.request.body || {};
	if (!SESI[jenis_presensi]) ctx.throw(400, 'Sesi presensi tidak valid');
	if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(long))) {
		ctx.throw(400, 'Lokasi perangkat wajib diizinkan');
	}
	const imageMatch = typeof foto === 'string' && foto.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+=*)$/);
	if (!imageMatch) ctx.throw(400, 'Bukti foto tidak valid');

	const geoResult = checkAsramaRadius(Number(lat), Number(long));
	if (!geoResult.allowed) {
		ctx.throw(400, `Lokasi Anda berada di luar area asrama UNAND. Gedung terdekat: ${geoResult.gedungNama} (${geoResult.jarakMeter}m). Radius yang diizinkan: 30m.`);
	}

	const now = new Date();
	const minutes = now.getHours() * 60 + now.getMinutes();
	const session = SESI[jenis_presensi];
	if (minutes < session.start || minutes > session.end) {
		ctx.throw(400, 'Presensi hanya dapat dikirim pada jadwal sesi yang aktif');
	}

	const today = now.toLocaleDateString('sv-SE');
	const clock = now.toTimeString().slice(0, 8);
	const existing = await prisma.$queryRaw`
		SELECT id, status FROM presensi
		WHERE nim = ${ctx.state.user.nim} AND tanggal = ${today} AND sesi = ${jenis_presensi}
		LIMIT 1
	`;
	if (existing.length) {
		ctx.throw(409, existing[0].status === 'izin'
			? 'Anda memiliki izin yang disetujui untuk sesi ini'
			: 'Anda sudah mengirim presensi untuk sesi ini');
	}

	const uploadDir = path.join(__dirname, '../../uploads/foto_wajah');
	await fs.mkdir(uploadDir, { recursive: true });
	const filename = `${randomUUID()}.${imageMatch[1] === 'png' ? 'png' : 'jpg'}`;
	const photoPath = path.join(uploadDir, filename);
	await fs.writeFile(photoPath, Buffer.from(imageMatch[2], 'base64'));

	try {
		await prisma.$executeRaw`
			INSERT INTO presensi (nim, tanggal, jam, waktu, lat, \`long\`, foto_wajah, status, sesi, keterangan)
			VALUES (${ctx.state.user.nim}, ${today}, ${clock}, ${now}, ${Number(lat)}, ${Number(long)},
			        ${`/uploads/foto_wajah/${filename}`}, 'hadir', ${jenis_presensi}, ${`Sesi: ${jenis_presensi} • ${geoResult.gedungNama}`})
		`;
		ctx.status = 201;
		ctx.body = { record: { id: null, nim: ctx.state.user.nim, tanggal: today, jam: clock, status: 'hadir' } };
	} catch (error) {
		await fs.unlink(photoPath).catch(() => {});
		throw error;
	}
}

/** Koreksi status presensi. Admin: bebas. Fasil: hanya binaan, hanya alpa<->izin, bila fitur diaktifkan. */
async function correct(ctx) {
	const id = Number(ctx.params.id);
	const { status, keterangan } = ctx.request.body || {};
	if (!['hadir', 'izin', 'alpa', 'terlambat'].includes(status)) ctx.throw(400, 'Status tidak valid');
	if (!keterangan || String(keterangan).trim().length < 3) ctx.throw(400, 'Keterangan koreksi wajib diisi');

	const [row] = await prisma.$queryRaw`
		SELECT p.id, p.status, u.fasil_id FROM presensi p JOIN \`user\` u ON u.nim = p.nim WHERE p.id = ${id} LIMIT 1`;
	if (!row) ctx.throw(404, 'Data presensi tidak ditemukan');

	const { role, nim } = ctx.state.user;
	if (role === 'fasil') {
		if (process.env.FASIL_KOREKSI_ENABLED === 'false') ctx.throw(403, 'Koreksi oleh fasil belum diaktifkan');
		if (row.fasil_id !== nim) ctx.throw(403, 'Penghuni ini bukan binaan Anda');
		if (!['alpa', 'izin'].includes(row.status) || !['alpa', 'izin'].includes(status)) {
			ctx.throw(403, 'Fasil hanya dapat mengoreksi status alpa atau izin');
		}
	}

	const note = `Koreksi ${row.status} → ${status} oleh ${nim}: ${String(keterangan).trim()}`.slice(0, 1000);
	await prisma.$executeRaw`UPDATE presensi SET status = ${status}, keterangan = ${note} WHERE id = ${id}`;
	ctx.body = { success: true, id, status, keterangan: note };
}

async function remove(ctx) {
	const id = Number(ctx.params.id);
	const [row] = await prisma.$queryRaw`SELECT foto_wajah FROM presensi WHERE id = ${id} LIMIT 1`;
	if (!row) ctx.throw(404, 'Data presensi tidak ditemukan');
	await prisma.$executeRaw`DELETE FROM presensi WHERE id = ${id}`;
	if (row.foto_wajah && row.foto_wajah.startsWith('/uploads/foto_wajah/')) {
		await fs.unlink(path.join(__dirname, '../..', row.foto_wajah)).catch(() => {});
	}
	ctx.body = { success: true };
}

module.exports = { list, create, correct, remove };
