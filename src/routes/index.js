const Router = require('@koa/router');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const izinController = require('../controllers/izinController');
const presensiController = require('../controllers/presensiController');
const reportController = require('../controllers/reportController');
const authenticate = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const prisma = require('../config/database');

const router = new Router({ prefix: '/api' });

router.get('/health', async (ctx) => {
	try {
		await prisma.$queryRaw`SELECT 1`;
		ctx.body = { message: 'Server dan database MySQL terhubung' };
	} catch {
		ctx.throw(503, 'Database MySQL belum terhubung');
	}
});
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticate, authController.me);
router.get('/users', authenticate, allowRoles('admin'), adminController.listUsers);
router.post('/users', authenticate, allowRoles('admin'), adminController.createUser);
router.put('/users/:nim', authenticate, allowRoles('admin'), adminController.updateUser);
router.delete('/users/:nim', authenticate, allowRoles('admin'), adminController.deleteUser);
router.get('/gedung', authenticate, allowRoles('admin', 'fasil'), adminController.listGedung);
router.post('/gedung', authenticate, allowRoles('admin'), adminController.createGedung);
router.post('/kamar', authenticate, allowRoles('admin'), adminController.createKamar);
router.delete('/kamar/:id', authenticate, allowRoles('admin'), adminController.deleteKamar);
router.get('/residents', authenticate, allowRoles('admin', 'fasil'), adminController.listResidents);
router.get('/presensi', authenticate, presensiController.list);
router.post('/presensi', authenticate, allowRoles('penghuni'), presensiController.create);
router.patch('/presensi/:id', authenticate, allowRoles('admin', 'fasil'), presensiController.correct);
router.delete('/presensi/:id', authenticate, allowRoles('admin'), presensiController.remove);
router.get('/izin', authenticate, izinController.list);
router.post('/izin', authenticate, allowRoles('penghuni'), upload.single('bukti'), izinController.create);
router.patch('/izin/:id/status', authenticate, allowRoles('fasil', 'admin'), izinController.updateStatus);

router.get('/dashboard/admin', authenticate, allowRoles('admin'), reportController.adminDashboard);
router.get('/dashboard/fasil', authenticate, allowRoles('fasil'), reportController.fasilDashboard);
router.get('/rekap', authenticate, allowRoles('admin', 'fasil'), reportController.rekap);
router.get('/riwayat', authenticate, allowRoles('admin'), reportController.riwayat);
router.get('/riwayat/export', authenticate, allowRoles('admin'), reportController.riwayatExport);
router.get('/binaan/:nim/kalender', authenticate, allowRoles('admin', 'fasil'), reportController.kalenderBinaan);

module.exports = router;
