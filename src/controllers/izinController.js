const prisma = require('../config/database');
const { applyIzin, todayKey } = require('../utils/attendance');

async function list(ctx) {
	const { role, nim } = ctx.state.user;
	let where = '1 = 1';
	const params = [];
	if (role === 'penghuni') { where = 'i.nim = ?'; params.push(nim); }
	else if (role === 'fasil') { where = 'u.fasil_id = ?'; params.push(nim); }
	if (ctx.query.nim && role !== 'penghuni') { where += ' AND i.nim = ?'; params.push(String(ctx.query.nim)); }
	if (['pending', 'disetujui', 'ditolak'].includes(ctx.query.status)) {
		where += ' AND i.status_izin = ?'; params.push(ctx.query.status);
	}
	const rows = await prisma.$queryRawUnsafe(
		`SELECT i.id, i.nim, DATE_FORMAT(i.tanggal, '%Y-%m-%d') AS tanggal, i.alasan, i.file_bukti, i.status_izin,
			DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i') AS diajukan,
			u.nama, u.email, u.kamar_id, k.no_kamar, k.lantai, g.nama AS nama_gedung
		 FROM izin i
		 JOIN \`user\` u ON u.nim = i.nim
		 LEFT JOIN kamar k ON k.id = u.kamar_id
		 LEFT JOIN gedung g ON g.id = k.gedung_id
		 WHERE ${where}
		 ORDER BY i.created_at DESC, i.id DESC`, ...params
	);
	ctx.body = {
		records: rows.map(row => ({
			id: row.id,
			nim: row.nim,
			id_user: row.nim,
			tanggal_izin: row.tanggal,
			tanggal: row.tanggal,
			diajukan: row.diajukan,
			alasan: row.alasan,
			file_bukti: row.file_bukti,
			status_izin: row.status_izin,
			user: {
				id: row.nim,
				nim_nip: row.nim,
				nama: row.nama,
				email: row.email,
				kamar: row.kamar_id === null ? null : {
					no_kamar: row.no_kamar,
					lantai: row.lantai,
					gedung: { nama_gedung: row.nama_gedung }
				}
			}
		}))
	};
}

async function create(ctx) {
	const body = ctx.request.body || {};
	const file = ctx.request.file;
	if (!body.tanggal_izin || !body.alasan || !file) {
		ctx.throw(400, 'Tanggal, alasan, dan berkas bukti wajib diisi');
	}
	const date = new Date(`${body.tanggal_izin}T00:00:00`);
	if (Number.isNaN(date.getTime())) ctx.throw(400, 'Tanggal izin tidak valid');

	const tanggal = date.toLocaleDateString('sv-SE');
	if (tanggal < todayKey()) ctx.throw(400, 'Tanggal izin tidak boleh sebelum hari ini');
	const duplicate = await prisma.$queryRaw`
		SELECT id FROM izin WHERE nim = ${ctx.state.user.nim} AND tanggal = ${tanggal}
		  AND status_izin IN ('pending', 'disetujui') LIMIT 1`;
	if (duplicate.length) ctx.throw(409, 'Anda sudah mengajukan izin untuk tanggal tersebut');

	const filePath = `/uploads/bukti_izin/${file.filename}`;
	await prisma.$executeRaw`
		INSERT INTO izin (nim, tanggal, alasan, file_bukti)
		VALUES (${ctx.state.user.nim}, ${tanggal}, ${body.alasan}, ${filePath})
	`;
	ctx.status = 201;
	ctx.body = { record: { nim: ctx.state.user.nim, tanggal, alasan: body.alasan, file_bukti: filePath } };
}

async function updateStatus(ctx) {
	const { id } = ctx.params;
	const { status } = ctx.request.body || {};
	if (!['disetujui', 'ditolak'].includes(status)) ctx.throw(400, 'Status harus disetujui atau ditolak');

	const [izin] = await prisma.$queryRaw`
		SELECT i.id, i.nim, DATE_FORMAT(i.tanggal, '%Y-%m-%d') AS tanggal, i.alasan, i.status_izin, u.fasil_id
		FROM izin i JOIN \`user\` u ON u.nim = i.nim WHERE i.id = ${Number(id)} LIMIT 1`;
	if (!izin) ctx.throw(404, 'Pengajuan izin tidak ditemukan');
	const { role, nim } = ctx.state.user;
	if (role === 'fasil' && izin.fasil_id !== nim) ctx.throw(403, 'Penghuni ini bukan binaan Anda');
	if (izin.status_izin !== 'pending') ctx.throw(409, 'Pengajuan ini sudah diproses');

	await prisma.$executeRaw`UPDATE izin SET status_izin = ${status} WHERE id = ${Number(id)}`;
	if (status === 'disetujui') await applyIzin(izin.nim, izin.tanggal, izin.alasan);
	ctx.body = { success: true, status_izin: status };
}

module.exports = { list, create, updateStatus };
