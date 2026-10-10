-- AlterTable: sesi presensi eksplisit (subuh/malam) agar rekap tidak bergantung pada teks keterangan
ALTER TABLE `presensi` ADD COLUMN `sesi` ENUM('subuh', 'malam') NULL;
UPDATE `presensi` SET `sesi` = CASE WHEN `jam` >= '12:00:00' THEN 'malam' ELSE 'subuh' END;
ALTER TABLE `presensi` MODIFY `sesi` ENUM('subuh', 'malam') NOT NULL;

-- CreateIndex
CREATE INDEX `presensi_nim_tanggal_sesi` ON `presensi`(`nim`, `tanggal`, `sesi`);
CREATE INDEX `presensi_tanggal` ON `presensi`(`tanggal`);

-- AlterTable: waktu pengajuan izin (untuk deteksi izin menggantung > 2 hari)
ALTER TABLE `izin` ADD COLUMN `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: kapasitas kamar (untuk deteksi kamar penuh/kosong)
ALTER TABLE `kamar` ADD COLUMN `kapasitas` INTEGER NOT NULL DEFAULT 2;

-- AlterTable: status aktif akun
ALTER TABLE `user` ADD COLUMN `aktif` BOOLEAN NOT NULL DEFAULT true;
