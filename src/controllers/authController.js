const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const viewPermissions = {
	penghuni: ['view-camera', 'view-riwayat'],
	fasil: ['view-fasilitator', 'view-riwayat-fasil'],
	admin: ['view-admin-monitoring', 'view-admin-pengguna', 'view-admin-riwayat']
};

function serializeUser(user) {
	const role = user.role || 'penghuni';
	return {
		id: user.nim,
		nim: user.nim,
		name: user.nama,
		email: user.email,
		role: role,
		roleTitle: role === 'penghuni' ? 'Penghuni' : role === 'fasil' ? 'Fasilitator' : 'Administrator',
		avatar: '',
		allowedViews: viewPermissions[role] || []
	};
}

async function login(ctx) {
	const { identifier, password } = ctx.request.body || {};
	if (!process.env.JWT_SECRET) ctx.throw(500, 'JWT_SECRET belum dikonfigurasi di file .env');
	if (!identifier || !password) {
		ctx.throw(400, 'NIM/NIP/email dan password wajib diisi');
	}

	const users = await prisma.$queryRaw`
		SELECT nim, nama, email, password, kamar_id, role, aktif
		FROM \`user\`
		WHERE nim = ${identifier} OR email = ${identifier}
		LIMIT 1
	`;
	const user = users[0];
	if (user && !user.aktif) ctx.throw(403, 'Akun dinonaktifkan. Hubungi admin asrama');
	const isBcryptHash = user && /^\$2[aby]\$\d{2}\$/.test(user.password);
	const passwordIsValid = user && (isBcryptHash
		? await bcrypt.compare(password, user.password)
		: password === user.password);

	if (!passwordIsValid) {
		ctx.throw(401, 'NIM/NIP/email atau password tidak valid');
	}

	if (!isBcryptHash) {
		const upgradedPassword = await bcrypt.hash(password, 12);
		await prisma.$executeRaw`
			UPDATE \`user\`
			SET password = ${upgradedPassword}
			WHERE nim = ${user.nim} AND password = ${user.password}
		`;
	}

	const token = jwt.sign(
		{ nim: user.nim, role: user.role || 'penghuni' },
		process.env.JWT_SECRET,
		{ expiresIn: '12h' }
	);

	ctx.body = { token, user: serializeUser(user) };
}

async function me(ctx) {
	const users = await prisma.$queryRaw`
		SELECT nim, nama, email, kamar_id, role
		FROM \`user\`
		WHERE nim = ${ctx.state.user.nim}
		LIMIT 1
	`;
	const user = users[0];
	if (!user) ctx.throw(404, 'Akun tidak ditemukan');
	ctx.body = { user: serializeUser(user) };
}

module.exports = { login, me, serializeUser };
