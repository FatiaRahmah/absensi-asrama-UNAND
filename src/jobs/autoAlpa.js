const { ensureAlpa } = require('../utils/attendance');

/**
 * Job otomatis harian: setiap sesi (Subuh 04:00–06:00, Malam 18:00–20:30) yang sudah
 * berakhir tanpa presensi/izin dicatat sebagai "alpa". Dicek tiap menit (idempoten),
 * dan saat start juga menutup sesi kemarin bila server sempat mati.
 */
function startAutoAlpa({ intervalMs = 60 * 1000, backfillDays = 1 } = {}) {
	let running = false;
	const run = async () => {
		if (running) return;
		running = true;
		try {
			await ensureAlpa(new Date(), backfillDays);
		} catch (err) {
			console.error('Auto-alpa gagal:', err.message);
		} finally {
			running = false;
		}
	};
	run();
	const timer = setInterval(run, intervalMs);
	console.log('⏰ Auto-alpa aktif (sesi Subuh & Malam setiap hari)');
	return () => clearInterval(timer);
}

module.exports = { startAutoAlpa };
