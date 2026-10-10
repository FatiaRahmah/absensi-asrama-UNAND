/*
  Warnings:

  - You are about to drop the column `nama_gedung` on the `gedung` table. All the data in the column will be lost.
  - You are about to drop the column `approved_by` on the `izin` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `izin` table. All the data in the column will be lost.
  - You are about to drop the column `id_user` on the `izin` table. All the data in the column will be lost.
  - You are about to drop the column `tanggal_izin` on the `izin` table. All the data in the column will be lost.
  - You are about to drop the column `id_gedung` on the `kamar` table. All the data in the column will be lost.
  - You are about to alter the column `no_kamar` on the `kamar` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(20)`.
  - You are about to drop the column `id_user` on the `presensi` table. All the data in the column will be lost.
  - You are about to drop the column `jenis_presensi` on the `presensi` table. All the data in the column will be lost.
  - You are about to drop the column `waktu_presensi` on the `presensi` table. All the data in the column will be lost.
  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `id_kamar` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `nim_nip` on the `user` table. All the data in the column will be lost.
  - You are about to alter the column `nama` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `email` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - Added the required column `nama` to the `gedung` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nim` to the `izin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tanggal` to the `izin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gedung_id` to the `kamar` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jam` to the `presensi` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nim` to the `presensi` table without a default value. This is not possible if the table is not empty.
  - Added the required column `waktu` to the `presensi` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nim` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `izin` DROP FOREIGN KEY `Izin_approved_by_fkey`;

-- DropForeignKey
ALTER TABLE `izin` DROP FOREIGN KEY `Izin_id_user_fkey`;

-- DropForeignKey
ALTER TABLE `kamar` DROP FOREIGN KEY `Kamar_id_gedung_fkey`;

-- DropForeignKey
ALTER TABLE `presensi` DROP FOREIGN KEY `Presensi_id_user_fkey`;

-- DropForeignKey
ALTER TABLE `user` DROP FOREIGN KEY `User_id_kamar_fkey`;

-- DropIndex
DROP INDEX `Presensi_id_user_jenis_presensi_tanggal_key` ON `presensi`;

-- DropIndex
DROP INDEX `User_nim_nip_key` ON `user`;

-- AlterTable
ALTER TABLE `gedung` DROP COLUMN `nama_gedung`,
    ADD COLUMN `id_user` INTEGER NULL,
    ADD COLUMN `nama` VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE `izin` DROP COLUMN `approved_by`,
    DROP COLUMN `created_at`,
    DROP COLUMN `id_user`,
    DROP COLUMN `tanggal_izin`,
    ADD COLUMN `nim` VARCHAR(20) NOT NULL,
    ADD COLUMN `tanggal` DATE NOT NULL,
    MODIFY `alasan` TEXT NOT NULL,
    MODIFY `file_bukti` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `kamar` DROP COLUMN `id_gedung`,
    ADD COLUMN `gedung_id` INTEGER NOT NULL,
    MODIFY `no_kamar` VARCHAR(20) NOT NULL;

-- AlterTable
ALTER TABLE `presensi` DROP COLUMN `id_user`,
    DROP COLUMN `jenis_presensi`,
    DROP COLUMN `waktu_presensi`,
    ADD COLUMN `jam` TIME(0) NOT NULL,
    ADD COLUMN `nim` VARCHAR(20) NOT NULL,
    ADD COLUMN `waktu` DATETIME(0) NOT NULL,
    MODIFY `lat` DECIMAL(10, 8) NULL,
    MODIFY `long` DECIMAL(11, 8) NULL,
    MODIFY `foto_wajah` VARCHAR(255) NULL,
    MODIFY `status` ENUM('hadir', 'izin', 'alpa', 'terlambat') NOT NULL,
    MODIFY `keterangan` TEXT NULL;

-- AlterTable
ALTER TABLE `user` DROP PRIMARY KEY,
    DROP COLUMN `created_at`,
    DROP COLUMN `id`,
    DROP COLUMN `id_kamar`,
    DROP COLUMN `nim_nip`,
    ADD COLUMN `asal` VARCHAR(100) NULL,
    ADD COLUMN `fasil_id` VARCHAR(20) NULL,
    ADD COLUMN `gedung_id` INTEGER NULL,
    ADD COLUMN `jekel` ENUM('L', 'P') NULL,
    ADD COLUMN `kamar_id` INTEGER NULL,
    ADD COLUMN `nim` VARCHAR(20) NOT NULL,
    ADD COLUMN `telepon` VARCHAR(20) NULL,
    MODIFY `nama` VARCHAR(100) NOT NULL,
    MODIFY `email` VARCHAR(100) NOT NULL,
    MODIFY `password` VARCHAR(255) NOT NULL,
    MODIFY `role` ENUM('admin', 'fasil', 'penghuni') NOT NULL DEFAULT 'penghuni',
    ADD PRIMARY KEY (`nim`);

-- CreateIndex
CREATE INDEX `nim` ON `izin`(`nim`);

-- CreateIndex
CREATE INDEX `gedung_id` ON `kamar`(`gedung_id`);

-- CreateIndex
CREATE INDEX `nim` ON `presensi`(`nim`);

-- CreateIndex
CREATE INDEX `kamar_id` ON `user`(`kamar_id`);

-- CreateIndex
CREATE INDEX `fasil_id` ON `user`(`fasil_id`);

-- CreateIndex
CREATE INDEX `gedung_id` ON `user`(`gedung_id`);

-- AddForeignKey
ALTER TABLE `izin` ADD CONSTRAINT `izin_ibfk_1` FOREIGN KEY (`nim`) REFERENCES `user`(`nim`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kamar` ADD CONSTRAINT `kamar_ibfk_1` FOREIGN KEY (`gedung_id`) REFERENCES `gedung`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presensi` ADD CONSTRAINT `presensi_ibfk_1` FOREIGN KEY (`nim`) REFERENCES `user`(`nim`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_ibfk_1` FOREIGN KEY (`kamar_id`) REFERENCES `kamar`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_ibfk_fasil` FOREIGN KEY (`fasil_id`) REFERENCES `user`(`nim`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_ibfk_gedung` FOREIGN KEY (`gedung_id`) REFERENCES `gedung`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
CREATE UNIQUE INDEX `email` ON `user`(`email`);
DROP INDEX `User_email_key` ON `user`;
