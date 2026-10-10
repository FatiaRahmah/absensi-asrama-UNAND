const bcrypt = require('bcryptjs');
const prisma = require('../config/database');

const ROLES = ['admin', 'fasil', 'penghuni'];

function mapUser(row) {
	return {
		id: row.nim,
		nim_nip: row.nim,
		nama: row.nama,
		email: row.email,
		role: row.role || 'penghuni',
		aktif: Boolean(row.aktif),
		fasil_id: row.fasil_id,
		fasil_nama: row.fasil_nama || null,
		gedung_id: row.gedung_id,
		kamar_id: row.kamar_id,
		kamar: row.kamar_id === null ? null : {
			id: row.kamar_id,
			no_kamar: row.no_kamar,
			lantai: row.lantai,
			gedung_id: row.k_gedung_id,
			gedung: { id: row.k_gedung_id, nama_gedung: row.nama_gedung }
		},
		gedung: row.pj_gedung_id ? { id: row.pj_gedung_id, nama: row.pj_nama_gedung } : null
	};
}

const USER_SELECT = `
	SELECT u.nim, u.nama, u.email, u.kamar_id, u.role, u.aktif, u.fasil_id, u.gedung_id,
	       f.nama AS fasil_nama,
	       k.no_kamar, k.lantai, k.gedung_id AS k_gedung_id, g.nama AS nama_gedung,
	       pj_g.id AS pj_gedung_id, pj_g.nama AS pj_nama_gedung
	FROM \`user\` u
	LEFT JOIN \`user\` f ON f.nim = u.fasil_id
	LEFT JOIN kamar k ON k.id = u.kamar_id
	LEFT JOIN gedung g ON g.id = k.gedung_id
	LEFT JOIN gedung pj_g ON pj_g.id = u.gedung_id`;

async function fetchUsers() {
	const rows = await prisma.$queryRawUnsafe(`${USER_SELECT} ORDER BY u.nama`);
	return rows.map(mapUser);
}

async function fetchUser(nim) {
	const rows = await prisma.$queryRawUnsafe(`${USER_SELECT} WHERE u.nim = ? LIMIT 1`, nim);
	return rows[0] ? mapUser(rows[0]) : null;
}

async function listUsers(ctx) {
	const users = await fetchUsers();
	ctx.body = { users: ctx.query.role ? users.filter(user => user.role === ctx.query.role) : users };
}

async function listResidents(ctx) {
	const users = await fetchUsers();
	const { role, nim } = ctx.state.user;
	ctx.body = {
		users: users.filter(user => user.role === 'penghuni' && (role !== 'fasil' || user.fasil_id === nim))
	};
}

/** Kosongkan field yang tidak relevan untuk role dan validasi relasi. */
async function normalizeRelations(ctx, role, input) {
	const rel = { kamar_id: null, fasil_id: null, gedung_id: null };
	if (role === 'penghuni') {
		rel.kamar_id = input.id_kamar ? Number(input.id_kamar) : null;
		rel.fasil_id = input.fasil_id || null;
		if (rel.fasil_id) {
			const [fasil] = await prisma.$queryRaw`SELECT nim FROM \`user\` WHERE nim = ${rel.fasil_id} AND role = 'fasil' LIMIT 1`;
			if (!fasil) ctx.throw(400, 'Fasil penanggung jawab tidak ditemukan');
		}
	} else if (role === 'fasil') {
		rel.gedung_id = input.gedung_id ? Number(input.gedung_id) : null;
	}
	return rel;
}

async function createUser(ctx) {
	const body = ctx.request.body || {};
	const { nim_nip, nama, email, password, role } = body;
	if (!nim_nip || !nama || !email || !password || !role) {
		ctx.throw(400, 'NIM/NIP, nama, email, password, dan role wajib diisi');
	}
	if (!ROLES.includes(role)) ctx.throw(400, 'Role tidak valid');
	if (password.length < 6) ctx.throw(400, 'Password minimal 6 karakter');
	const rel = await normalizeRelations(ctx, role, body);

	await prisma.$executeRaw`
		INSERT INTO \`user\` (nim, nama, email, password, role, kamar_id, fasil_id, gedung_id, aktif)
		VALUES (
			${String(nim_nip).trim()}, ${nama}, ${email}, ${await bcrypt.hash(password, 12)},
			${role}, ${rel.kamar_id}, ${rel.fasil_id}, ${rel.gedung_id}, ${body.aktif === false ? 0 : 1}
		)
	`;
	ctx.status = 201;
	ctx.body = { user: await fetchUser(String(nim_nip).trim()) };
}

async function updateUser(ctx) {
	const { nim } = ctx.params;
	const current = await fetchUser(nim);
	if (!current) ctx.throw(404, 'Pengguna tidak ditemukan');
	const body = ctx.request.body || {};
	const role = body.role || current.role;
	if (!ROLES.includes(role)) ctx.throw(400, 'Role tidak valid');
	if (nim === ctx.state.user.nim && (role !== 'admin' || body.aktif === false)) {
		ctx.throw(400, 'Anda tidak dapat menurunkan role atau menonaktifkan akun sendiri');
	}
	const rel = await normalizeRelations(ctx, role, {
		id_kamar: 'id_kamar' in body ? body.id_kamar : current.kamar_id,
		fasil_id: 'fasil_id' in body ? body.fasil_id : current.fasil_id,
		gedung_id: 'gedung_id' in body ? body.gedung_id : current.gedung_id
	});

	const sets = ['nama = ?', 'email = ?', 'role = ?', 'kamar_id = ?', 'fasil_id = ?', 'gedung_id = ?', 'aktif = ?'];
	const params = [
		body.nama || current.nama, body.email || current.email, role,
		rel.kamar_id, rel.fasil_id, rel.gedung_id,
		'aktif' in body ? (body.aktif ? 1 : 0) : (current.aktif ? 1 : 0)
	];
	if (body.password) {
		if (body.password.length < 6) ctx.throw(400, 'Password minimal 6 karakter');
		sets.push('password = ?');
		params.push(await bcrypt.hash(body.password, 12));
	}
	params.push(nim);
	await prisma.$executeRawUnsafe(`UPDATE \`user\` SET ${sets.join(', ')} WHERE nim = ?`, ...params);
	ctx.body = { user: await fetchUser(nim) };
}

async function deleteUser(ctx) {
	const { nim } = ctx.params;
	if (nim === ctx.state.user.nim) ctx.throw(400, 'Anda tidak dapat menghapus akun sendiri');
	await prisma.$executeRaw`DELETE FROM \`user\` WHERE nim = ${nim}`;
	ctx.body = { success: true };
}

async function listGedung(ctx) {
	const gedungs = await prisma.$queryRaw`SELECT id, nama AS nama_gedung, nama FROM gedung ORDER BY nama`;
	const kamars = await prisma.$queryRaw`
		SELECT k.id, k.no_kamar, k.lantai, k.gedung_id, k.kapasitas,
		       (SELECT COUNT(*) FROM \`user\` u WHERE u.kamar_id = k.id AND u.role = 'penghuni' AND u.aktif = 1) AS terisi
		FROM kamar k ORDER BY k.gedung_id, k.no_kamar`;
	ctx.body = {
		gedungs: gedungs.map(g => ({
			id: g.id,
			nama: g.nama,
			nama_gedung: g.nama_gedung,
			kamar: kamars.filter(k => k.gedung_id === g.id).map(k => ({ ...k, terisi: Number(k.terisi) }))
		}))
	};
}

async function createGedung(ctx) {
	const nama = String((ctx.request.body || {}).nama || '').trim();
	if (!nama) ctx.throw(400, 'Nama gedung wajib diisi');
	await prisma.$executeRaw`INSERT INTO gedung (nama) VALUES (${nama})`;
	ctx.status = 201;
	ctx.body = { success: true };
}

async function createKamar(ctx) {
	const { gedung_id, no_kamar, lantai, kapasitas } = ctx.request.body || {};
	if (!gedung_id || !no_kamar || !String(no_kamar).trim()) ctx.throw(400, 'Gedung dan nomor kamar wajib diisi');
	const cap = Number(kapasitas) > 0 ? Number(kapasitas) : 2;
	await prisma.$executeRaw`
		INSERT INTO kamar (gedung_id, no_kamar, lantai, kapasitas)
		VALUES (${Number(gedung_id)}, ${String(no_kamar).trim()}, ${Number(lantai) || 1}, ${cap})`;
	ctx.status = 201;
	ctx.body = { success: true };
}

async function deleteKamar(ctx) {
	await prisma.$executeRaw`DELETE FROM kamar WHERE id = ${Number(ctx.params.id)}`;
	ctx.body = { success: true };
}

module.exports = {
	listUsers, listResidents, createUser, updateUser, deleteUser, listGedung, createGedung, createKamar, deleteKamar
};
