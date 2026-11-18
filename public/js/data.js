/* ==========================================================================
   Portal Asrama UNAND - Master Data, Accounts & Authentication
   ========================================================================== */

const ApiClient = {
  token: localStorage.getItem('asrama_token'),

  async request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    if (!(options.body instanceof FormData) && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`/api${path}`, { ...options, headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Permintaan ke server gagal');
    return result;
  },

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('asrama_token', token);
    else localStorage.removeItem('asrama_token');
  }
};

const AppData = {
  // Current logged in session user
  sessionUser: null, // set to user object upon login

  accounts: [],

  // Active Schedules:
  // Shubuh: 04.00 - 06.00 WIB | Malam: 18.00 - 20.30 WIB
  schedules: {
    shubuh: { title: 'Sesi Shubuh', start: '04:00', end: '06:00', label: '04:00 - 06:00 WIB' },
    malam: { title: 'Sesi Malam', start: '18:00', end: '20:30', label: '18:00 - 20:30 WIB' }
  },

  // Private attendance history for Penghuni (Muhammad Fajar)
  riwayatPenghuniPrivate: [
    {
      id: "HIST-001",
      tanggal: "23 Okt 2024",
      sesi: "Malam (18.00-20.30)",
      metode: "Presensi Biometrik Wajah",
      waktuBukti: "19:18 WIB • Geofence Match (0.02km)",
      status: "Hadir Tepat Waktu",
      statusCode: "hadir",
      detail: "Presensi biometrik tervalidasi via webcam HD Limau Manis (Match 98.6%)"
    },
    {
      id: "HIST-002",
      tanggal: "23 Okt 2024",
      sesi: "Shubuh (04.00-06.00)",
      metode: "Presensi Biometrik Wajah",
      waktuBukti: "05:12 WIB • Geofence Match (0.01km)",
      status: "Hadir Tepat Waktu",
      statusCode: "hadir",
      detail: "Presensi biometrik tervalidasi via webcam HD Limau Manis (Match 99.1%)"
    },
    {
      id: "HIST-003",
      tanggal: "22 Okt 2024",
      sesi: "Malam",
      metode: "Surat Dokter Klinik Pratama UNAND",
      waktuBukti: "Disetujui 19:40 WIB • Fasilitator Gedung A",
      status: "Izin Disetujui",
      statusCode: "izin",
      fileName: "Surat_Dokter_Klinik_Pratama.pdf",
      detail: "Permohonan disetujui oleh Ust. Ilham Ramadhan, S.Kom."
    },
    {
      id: "HIST-004",
      tanggal: "24 Okt 2024",
      sesi: "Malam",
      metode: "Permohonan Izin Baru",
      waktuBukti: "Diajukan 14:15 WIB • Surat Tugas Terlampir",
      status: "Menunggu Persetujuan",
      statusCode: "pending",
      fileName: "Surat_Izin_Dosen_Kegiatan.pdf",
      detail: "Dalam proses disposisi fasilitator pembina gedung A."
    }
  ],

  // Master Data Students (Admin & Facilitator view)
  studentsMaster: [
    {
      nim: "2311522001",
      nama: "Muhammad Fajar",
      fakultas: "Sistem Informasi",
      fakultasDetail: "Fakultas Teknologi Informasi",
      kamar: "Blok A - Lt. 2 (Kmr 204)",
      fasilitator: "Ust. Ilham Ramadhan, S.Kom.",
      status: "Aktif",
      statusCode: "aktif",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    },
    {
      nim: "2318211845",
      nama: "Aisyah Zahra Putri",
      fakultas: "Pendidikan Dokter",
      fakultasDetail: "Fakultas Kedokteran (FK)",
      kamar: "Blok D - Lt. 1 (Kmr 102)",
      fasilitator: "Ustah. Nurul Fadilah, M.Pd.",
      status: "Aktif",
      statusCode: "aktif",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
    },
    {
      nim: "2310933012",
      nama: "Rizky Hadiyanto",
      fakultas: "Teknik Industri",
      fakultasDetail: "Fakultas Teknik (FT)",
      kamar: "Blok B - Lt. 3 (Kmr 314)",
      fasilitator: "Ust. Zulfikar, S.T.",
      status: "Cuti Resmi",
      statusCode: "cuti",
      avatar: ""
    },
    {
      nim: "2310531008",
      nama: "Bima Arya Pratama",
      fakultas: "Akuntansi Internasional",
      fakultasDetail: "Fakultas Ekonomi & Bisnis",
      kamar: "Blok A - Lt. 1 (Kmr 108)",
      fasilitator: "Ust. Ilham Ramadhan, S.Kom.",
      status: "Aktif",
      statusCode: "aktif",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
    },
    {
      nim: "2318112844",
      nama: "Nadia Adelia Putri",
      fakultas: "Ilmu Hukum",
      fakultasDetail: "Fakultas Hukum (FH)",
      kamar: "Blok E - Lt. 2 (Kmr 219)",
      fasilitator: "Ustah. Nurul Fadilah, M.Pd.",
      status: "Aktif",
      statusCode: "aktif",
      avatar: ""
    }
  ],

  // Master Data Facilitators (Admin View & Add)
  facilitatorsMaster: [
    {
      id: "FAS-001",
      nim: "198504122010121001",
      nama: "Ust. Ilham Ramadhan, S.Kom.",
      gedung: "Blok A & Blok B (Putra)",
      binaanCount: 35,
      phone: "0812-0783-3912",
      status: "Aktif"
    },
    {
      id: "FAS-002",
      nip: "198809202014032002",
      nama: "Ustah. Nurul Fadilah, M.Pd.",
      gedung: "Blok D & Blok E (Putri)",
      binaanCount: 40,
      phone: "0821-0994-4105",
      status: "Aktif"
    },
    {
      id: "FAS-003",
      nip: "199101152018011003",
      nama: "Ust. Zulfikar, S.T.",
      gedung: "Blok C (Putra)",
      binaanCount: 30,
      phone: "0813-0556-1289",
      status: "Aktif"
    }
  ],

  // Leave approval queue
  approvalQueue: [
    {
      id: "APP-101",
      nama: "Rian Pratama",
      nim: "2311522004",
      kamar: "Kamar B-201 (Lt. 2)",
      kategori: "Sakit / Medis",
      waktu: "05:12 WIB",
      alasan: "Demam tinggi dan pusing mendadak sejak malam, sedang dirawat di RS Universitas Andalas Limau Manis.",
      fileName: "Surat_Dokter_Klinik.jpg",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
    },
    {
      id: "APP-102",
      nama: "Ahmad Fauzi",
      nim: "2210931018",
      kamar: "Kamar B-105 (Lt. 1)",
      kategori: "Tugas Kampus",
      waktu: "04:45 WIB",
      alasan: "Mewakili Universitas Andalas dalam Lomba Debat Konstitusi Nasional di Pekanbaru Riau, berangkat subuh ini.",
      fileName: "Dispensasi_Fakultas.pdf",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80"
    }
  ],

  // Shubuh monitoring list
  monitoringShubuh: [
    {
      nim: "2311521008",
      nama: "Muhammad Fajar",
      initials: "MF",
      kamar: "Kamar B-204 Lt. 2",
      waktu: "04:42:19 WIB",
      subtext: "Biometrik Terverifikasi (Geofence OK)",
      foto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      status: "Hadir Tepat Waktu",
      statusCode: "hadir",
      catatan: "Terverifikasi otomatis di Gedung Menza"
    },
    {
      nim: "2311522038",
      nama: "Ilham Ramadhan",
      initials: "IR",
      kamar: "Kamar B-310 Lt. 3",
      waktu: "04:55:02 WIB",
      subtext: "Biometrik Terverifikasi (Geofence OK)",
      foto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      status: "Hadir Tepat Waktu",
      statusCode: "hadir",
      catatan: "-"
    },
    {
      nim: "2310811044",
      nama: "Hendra Wijaya",
      initials: "HW",
      kamar: "Kamar B-102 Lt. 1",
      waktu: "--:--:--",
      subtext: "Batas Shubuh 06:00 Terlewati",
      foto: null,
      status: "Belum Hadir / Alpa",
      statusCode: "alpa",
      catatan: "Sudah dihubungi via WA belum merespon"
    },
    {
      nim: "2311522004",
      nama: "Rian Pratama",
      initials: "RP",
      kamar: "Kamar B-201 Lt. 2",
      waktu: "05:12:00 WIB",
      subtext: "Pengajuan Sakit (Dokter)",
      foto: null,
      status: "Izin (Menunggu Verifikasi)",
      statusCode: "izin",
      catatan: "Dirawat di RS UNAND"
    },
    {
      nim: "2310212015",
      nama: "Yusuf Maulana",
      initials: "YM",
      kamar: "Kamar B-302 Lt. 3",
      waktu: "04:38:11 WIB",
      subtext: "Biometrik Terverifikasi (Geofence OK)",
      foto: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      status: "Hadir Tepat Waktu",
      statusCode: "hadir",
      catatan: "-"
    },
    {
      nim: "2310923055",
      nama: "Dzaki Al-Farisi",
      initials: "DA",
      kamar: "Kamar B-308 Lt. 3",
      waktu: "--:--:--",
      subtext: "Belum Ada Aktivitas",
      foto: null,
      status: "Belum Hadir / Alpa",
      statusCode: "alpa",
      catatan: "-"
    }
  ]
};

Object.assign(AppData, {
  riwayatPenghuniPrivate: [],
  riwayatPresensi: [],
  studentsMaster: [],
  facilitatorsMaster: [],
  approvalQueue: [],
  monitoringShubuh: []
});
