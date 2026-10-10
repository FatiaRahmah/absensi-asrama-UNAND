# 🏛️ Sistem Absensi Asrama UNAND (Koa.js)

Tugas Akhir Mata Kuliah **Pengembangan Aplikasi Berbasis Framework**. REST API Backend untuk pengelolaan absensi subuh/malam, pengajuan izin, dan manajemen pengguna di Asrama UNAND.

## 🛠️ Tech Stack
* **Framework:** Koa.js v2
* **Runtime:** Node.js
* **Database:** MySQL
* **ORM:** Prisma ORM v5
* **Authentication:** JSON Web Token (JWT) & bcryptjs
* **File Upload:** `@koa/multer`

## 🚀 Cara Menjalankan Project di Lokal

1. **Clone repository ini:**
   ```bash
   git clone [https://github.com/FatiaRahmah/sistem-absensi-asrama-unand-koa.git](https://github.com/FatiaRahmah/sistem-absensi-asrama-unand-koa.git)
   cd sistem-absensi-asrama-unand-koa
   ```

2. **Install dependency dan siapkan environment:**
   ```bash
   npm install
   Copy-Item .env.example .env
   ```
   Edit `.env` dan isi `DATABASE_URL` dengan user/password MySQL lokal. Nama database pada contoh adalah `asrama_db` (tanpa akhiran `.sql`); ganti jika nama database di MySQL berbeda. Ganti juga `JWT_SECRET` dengan secret acak yang panjang. Karena ERD tidak memiliki kolom role, daftarkan NIM admin dan fasilitator sebagai daftar dipisahkan koma pada `ADMIN_NIMS` dan `FACILITATOR_NIMS`. Password MySQL yang berisi karakter khusus harus di-URL-encode.

3. **Generate Prisma Client dan jalankan server:**
   ```bash
   npx prisma validate
   npx prisma generate
   npm run dev
   ```
   Buka `http://localhost:3000`. Database harus sudah berisi tabel yang sesuai dengan model pada `prisma/schema.prisma`. Langkah ini tidak menjalankan migrasi, `db push`, atau mengubah struktur database.

Login memakai nilai `nim_nip` atau `email` dan password yang tersimpan sebagai hash bcrypt. Endpoint aplikasi dilayani dari origin yang sama; data presensi dan izin hanya dapat dibaca sesuai role akun yang login.

Jika tabel `user` masih kosong, isi `ADMIN_NIMS` dengan NIM admin yang sama seperti `INITIAL_ADMIN_NIM`, lalu isi nama, email, dan password bootstrap di `.env`. Jalankan `npm run bootstrap:admin` satu kali. Script menolak berjalan jika tabel `user` sudah berisi akun. Hapus `INITIAL_ADMIN_PASSWORD` dari `.env` setelah bootstrap; daftar `ADMIN_NIMS` tetap diperlukan karena ERD tidak menyimpan role.
## Frontend React

- Dev: jalankan `npm run dev` (API :3000) dan `npm run dev:frontend` (Vite :5173, proxy ke API).
- Produksi: `npm run install:frontend` lalu `npm run build:frontend`; Koa otomatis menyajikan `frontend/dist` (fallback ke `public` bila belum di-build).
- Migrasi baru: `npx prisma migrate deploy`.
- Koreksi status oleh fasil dapat dimatikan dengan `FASIL_KOREKSI_ENABLED=false` di .env (menunggu persetujuan dosen).
