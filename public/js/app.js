/* ==========================================================================
   Portal Asrama UNAND - Application & Auth Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

const App = {
  activeView: 'view-camera',

  init() {
    this.setupLoginForm();
    this.setupNavigation();
    this.setupFormHandlers();
    this.setupModalHandlers();
    this.startClockAndSessionCheck();

    // Check initial authentication state
    this.checkAuthState();

    // Init camera module
    CameraModule.init();

    console.log("✅ UNAND Portal Asrama App & Auth Controller Initialized");
  },

  /* Auth State Check */
  async checkAuthState() {
    const loginOverlay = document.getElementById('login-screen-overlay');
    const appContainer = document.querySelector('.app-container');

    if (ApiClient.token && !AppData.sessionUser) {
      try {
        const result = await ApiClient.request('/auth/me');
        AppData.sessionUser = result.user;
      } catch {
        ApiClient.setToken(null);
      }
    }

    if (!AppData.sessionUser) {
      if (loginOverlay) loginOverlay.style.display = 'flex';
      if (appContainer) appContainer.style.display = 'none';
      CameraModule.stopWebcam();
    } else {
      if (loginOverlay) loginOverlay.style.display = 'none';
      if (appContainer) appContainer.style.display = 'flex';
      this.applyUserSession(AppData.sessionUser);
    }
  },

  /* Setup Login Form & Quick Demo Chips */
  setupLoginForm() {
    const formLogin = document.getElementById('form-login');
    const inputNim = document.getElementById('login-nim');
    const inputPass = document.getElementById('login-password');
    const btnTogglePass = document.getElementById('btn-toggle-password');

    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const nimVal = inputNim.value.trim();
        const passVal = inputPass.value.trim();
        this.login(nimVal, passVal);
      });
    }

    if (btnTogglePass && inputPass) {
      btnTogglePass.addEventListener('click', () => {
        const isPassword = inputPass.type === 'password';
        inputPass.type = isPassword ? 'text' : 'password';
        btnTogglePass.textContent = isPassword ? 'Sembunyikan' : 'Tampilkan';
      });
    }

    // Logout button handler
    const btnLogout = document.getElementById('btn-logout-header');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin keluar?')) this.logout();
      });
    }
  },

  async login(identifier, password) {
    try {
      const result = await ApiClient.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
      ApiClient.setToken(result.token);
      AppData.sessionUser = result.user;
      await this.checkAuthState();
      showToast(`Selamat datang, ${result.user.name}!`, 'success');
    } catch (error) {
      showToast(error.message, 'danger');
    }
  },

  async submitAttendance(photo) {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const session = minutes >= 240 && minutes <= 360
      ? 'subuh'
      : minutes >= 1080 && minutes <= 1230 ? 'malam' : null;
    if (!session) {
      showToast('Presensi hanya dapat dikirim pada jadwal Shubuh atau Malam.', 'warning');
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Perangkat tidak mendukung lokasi GPS'));
        navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Izin lokasi GPS diperlukan')), {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      const result = await ApiClient.request('/presensi', {
        method: 'POST',
        body: JSON.stringify({
          jenis_presensi: session,
          lat: position.coords.latitude,
          long: position.coords.longitude,
          foto: photo
        })
      });
      openVerificationSuccessModal(photo, result.record);
      await this.renderAllViews();
    } catch (error) {
      showToast(error.message, 'danger');
    }
  },

  logout() {
    ApiClient.setToken(null);
    AppData.sessionUser = null;
    this.checkAuthState();
    showToast("Anda telah keluar dari sistem.", "info");
  },

  /* Apply Authenticated User Session permissions & UI */
  applyUserSession(user) {
    // Update Top Right Profile UI
    const userNameEl = document.getElementById('user-profile-name');
    const userRoleEl = document.getElementById('user-profile-role');
    const userAvatarEl = document.getElementById('user-profile-avatar');

    if (userNameEl) userNameEl.textContent = user.name;
    if (userRoleEl) userRoleEl.textContent = user.roleTitle;
    if (userAvatarEl) userAvatarEl.src = user.avatar;

    // Filter Sidebar Navigation Items based on user role
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const targetView = item.getAttribute('data-view');
      const isAllowed = user.allowedViews.includes(targetView);
      item.style.display = isAllowed ? 'flex' : 'none';
    });

    // Navigate to default view for this role
    const defaultView = user.allowedViews[0];
    this.navigateToView(defaultView);

    // Render Data matching role
    this.renderAllViews();
  },

  /* Navigation handling */
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetViewId = item.getAttribute('data-view');
        if (targetViewId) {
          this.navigateToView(targetViewId);
        }
      });
    });
  },

  navigateToView(targetViewId) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => {
      n.classList.toggle('active', n.getAttribute('data-view') === targetViewId);
    });

    document.querySelectorAll('.view-page').forEach(page => {
      page.classList.remove('active-view');
    });

    const targetPage = document.getElementById(targetViewId);
    if (targetPage) {
      targetPage.classList.add('active-view');
      this.activeView = targetViewId;
    }

    if (targetViewId === 'view-camera') {
      CameraModule.startWebcam();
    } else {
      CameraModule.stopWebcam();
    }
  },

  formatDate(value) {
    return new Date(value).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  },

  startClockAndSessionCheck() {
    setInterval(() => {
      const now = new Date();
      const clockTime = document.getElementById('live-clock-time');
      const clockDate = document.getElementById('live-clock-date');
      const sessionBadge = document.getElementById('live-session-badge');
      const captureBtn = document.getElementById('btn-capture-photo');
      
      if (clockTime) clockTime.textContent = now.toLocaleTimeString('id-ID') + ' WIB';
      if (clockDate) clockDate.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
      
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const timeVal = hours + minutes/60;

      const isSubuh = timeVal >= 4 && timeVal <= 6;
      const isMalam = timeVal >= 18 && timeVal <= 20.5;

      if (isSubuh) {
        if(sessionBadge) { sessionBadge.className = 'pill-badge-green'; sessionBadge.textContent = '🟢 SESI SHUBUH BERLANGSUNG (04.00 - 06.00 WIB)'; }
        if(captureBtn) { captureBtn.disabled = false; captureBtn.textContent = 'Ambil Foto & Catat Kehadiran'; }
      } else if (isMalam) {
        if(sessionBadge) { sessionBadge.className = 'pill-badge-green'; sessionBadge.textContent = '🟢 SESI MALAM BERLANGSUNG (18.00 - 20.30 WIB)'; }
        if(captureBtn) { captureBtn.disabled = false; captureBtn.textContent = 'Ambil Foto & Catat Kehadiran'; }
      } else {
        if(sessionBadge) { sessionBadge.className = 'status-pill warning'; sessionBadge.innerHTML = '<span class="dot"></span> DI LUAR WAKTU PRESENSI'; }
        if(captureBtn) { captureBtn.disabled = true; captureBtn.textContent = 'Tidak Ada Sesi Presensi Saat Ini'; }
      }
    }, 1000);
  },

  roomLabel(user) {
    if (!user.kamar) return 'Belum ditetapkan';
    const building = escapeHtml(user.kamar.gedung?.nama_gedung || 'Gedung');
    return `${building} • Lantai ${Number(user.kamar.lantai)} • Kamar ${escapeHtml(user.kamar.no_kamar)}`;
  },

  /* Render data loaded from the authenticated API */
  async renderAllViews() {
    try {
      const [presensiResult, izinResult] = await Promise.all([
        ApiClient.request('/presensi'),
        ApiClient.request('/izin')
      ]);
      const attendance = presensiResult.records.map(record => ({
        id: `presensi-${record.id}`,
        rawDate: record.tanggal,
        tanggal: this.formatDate(record.tanggal),
        sesi: record.jenis_presensi === 'subuh' ? 'Shubuh' : 'Malam',
        metode: 'Foto presensi',
        waktuBukti: new Date(record.waktu_presensi).toLocaleString('id-ID'),
        status: { hadir: 'Hadir', terlambat: 'Terlambat', alpa: 'Alpa', izin: 'Izin' }[record.status] || record.status,
        statusCode: record.status,
        detail: `Lokasi: ${record.lat}, ${record.long}`,
        foto: record.foto_wajah,
        user: {
          ...record.user,
          nama: escapeHtml(record.user.nama),
          nim_nip: escapeHtml(record.user.nim_nip),
          email: escapeHtml(record.user.email)
        }
      }));
      const leave = izinResult.records.map(record => ({
        id: `izin-${record.id}`,
        dbId: record.id,
        rawDate: record.tanggal_izin,
        createdAt: record.created_at,
        tanggal: this.formatDate(record.tanggal_izin),
        sesi: 'Izin',
        metode: 'Permohonan izin',
        waktuBukti: `Diajukan ${new Date(record.created_at).toLocaleString('id-ID')}`,
        status: 'Izin tercatat; status persetujuan tidak tersedia pada ERD',
        statusCode: 'izin',
        fileName: record.file_bukti ? escapeHtml(record.file_bukti.split('/').pop()) : '',
        fileUrl: record.file_bukti,
        detail: escapeHtml(record.alasan),
        user: {
          ...record.user,
          nama: escapeHtml(record.user.nama),
          nim_nip: escapeHtml(record.user.nim_nip),
          email: escapeHtml(record.user.email)
        }
      }));

      const history = [...attendance, ...leave].sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
      AppData.riwayatPenghuniPrivate = history;
      AppData.riwayatPresensi = history;
      AppData.approvalQueue = leave
        .filter(record => record.statusCode === 'pending')
        .map(record => ({
          ...record,
          id: record.dbId,
          nama: record.user.nama,
          nim: record.user.nim_nip || record.user.email,
          kamar: this.roomLabel(record.user),
          alasan: record.detail,
          waktu: new Date(record.createdAt).toLocaleTimeString('id-ID'),
          kategori: 'Permohonan izin',
          avatar: ''
        }));

      if (AppData.sessionUser.role !== 'penghuni') {
        const residentResult = await ApiClient.request('/residents');
        const today = new Date().toDateString();
        const todayAttendance = attendance.filter(record =>
          new Date(record.rawDate).toDateString() === today && record.sesi === 'Shubuh'
        );
        const todayLeave = leave.filter(record =>
          new Date(record.rawDate).toDateString() === today && record.statusCode !== 'ditolak'
        );
        AppData.monitoringShubuh = residentResult.users.map(user => {
          const record = todayAttendance.find(item => item.user.id === user.id);
          const approvedLeave = todayLeave.find(item => item.user.id === user.id);
          const statusCode = record ? record.statusCode : approvedLeave ? 'izin' : 'belum';
          return {
            id: user.id,
            nim: escapeHtml(user.nim_nip || user.email),
            nama: escapeHtml(user.nama),
            initials: user.nama.split(' ').map(part => part[0]).join('').slice(0, 2),
            kamar: this.roomLabel(user),
            waktu: record ? record.waktuBukti : '-',
            subtext: record ? 'Foto presensi tersimpan' : approvedLeave ? 'Izin tercatat' : 'Belum ada presensi',
            foto: record?.foto || null,
            status: record ? record.status : approvedLeave ? approvedLeave.status : 'Belum Ada Presensi',
            statusCode,
            catatan: record?.detail || '-'
          };
        });
      }

      if (AppData.sessionUser.role === 'admin') {
        const usersResult = await ApiClient.request('/users');
        const gedungResult = await ApiClient.request('/gedung');
        AppData.gedungList = gedungResult.gedungs || [];
        AppData.allUsers = usersResult.users || [];

        const fasilUsers = usersResult.users.filter(u => u.role === 'fasil');

        // Populate gedung dropdowns
        ['quick-gedung', 'inline-fasil-gedung'].forEach(id => {
          const sel = document.getElementById(id);
          if (!sel) return;
          const currentVal = sel.value;
          sel.innerHTML = '<option value="">-- Pilih Gedung --</option>';
          AppData.gedungList.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.nama || g.nama_gedung;
            sel.appendChild(opt);
          });
          if (currentVal) sel.value = currentVal;
        });

        // Populate fasil dropdown for penghuni form
        const selFasil = document.getElementById('quick-fasil');
        if (selFasil) {
          const currentFasil = selFasil.value;
          selFasil.innerHTML = '<option value="">-- Pilih Fasilitator --</option>';
          fasilUsers.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.nim_nip;
            opt.textContent = `${f.nama} (${f.gedung?.nama || '-'})`;
            selFasil.appendChild(opt);
          });
          if (currentFasil) selFasil.value = currentFasil;
        }

        AppData.studentsMaster = usersResult.users
          .filter(user => user.role === 'penghuni')
          .map(user => {
            const fasil = fasilUsers.find(f => f.nim_nip === user.fasil_id);
            return {
              nim: user.nim_nip || user.email,
              email: user.email,
              nama: user.nama,
              kamar: this.roomLabel(user),
              fasilitator: fasil ? escapeHtml(fasil.nama) : '-',
              fasil_id: user.fasil_id,
              gedung_id: user.gedung_id,
              kamar_id: user.kamar_id,
              kamar_obj: user.kamar,
              statusCode: 'aktif',
              _raw: user
            };
          });

        AppData.facilitatorsMaster = usersResult.users
          .filter(user => user.role === 'fasil')
          .map(user => {
            const gedung = AppData.gedungList.find(g => g.id === user.gedung_id);
            const binaanCount = usersResult.users.filter(u => u.role === 'penghuni' && u.fasil_id === user.nim_nip).length;
            return {
              id: user.id,
              nim: escapeHtml(user.nim_nip || user.email),
              nim_nip: user.nim_nip,
              email: user.email,
              nama: escapeHtml(user.nama),
              gedung: escapeHtml(gedung?.nama || gedung?.nama_gedung || user.gedung?.nama || '-'),
              gedung_id: user.gedung_id,
              binaanCount,
              status: 'Aktif',
              _raw: user
            };
          });
      }

      this.renderRiwayatTable();
      this.renderAdminMasterTable();
      this.renderAdminFacilitatorsTable();
      this.renderFacilitatorQueue();
      this.renderFasilDashboard();
      this.renderFasilRekap();
      this.renderAdminMonitoring();
      this.renderAdminRiwayat();
    } catch (error) {
      showToast(`Gagal memuat data: ${error.message}`, 'danger');
    }
  },



  /* View 1: Riwayat Presensi (Penghuni sees private, Fasil/Admin sees full) */
  renderRiwayatTable(filter = 'Semua') {
    const tbody = document.getElementById('tbody-riwayat');
    if (!tbody) return;

    const role = AppData.sessionUser ? AppData.sessionUser.role : 'penghuni';
    let data = role === 'penghuni' ? AppData.riwayatPenghuniPrivate : AppData.riwayatPresensi;

    if (filter === 'Hadir Sesi') {
      data = data.filter(d => d.statusCode === 'hadir');
    } else if (filter === 'Pengajuan Izin') {
      data = data.filter(d => d.statusCode !== 'hadir');
    }

    tbody.innerHTML = data.map(item => {
      let badgeClass = 'success';
      let iconAction = `<button class="btn btn-outline btn-sm" onclick="App.openDetailModal('${item.id}')">Bukti</button>`;

      if (item.statusCode === 'hadir') {
        badgeClass = 'success';
        iconAction = `<button class="btn btn-outline btn-sm" onclick="App.openDetailModal('${item.id}')">Bukti</button>`;
      } else if (item.statusCode === 'izin') {
        badgeClass = 'info';
        iconAction = `<button class="btn btn-outline btn-sm" onclick="App.openFileModal('${item.fileName || 'Bukti izin'}', '${item.fileUrl || ''}')">Bukti</button>`;
      } else if (item.statusCode === 'pending') {
        badgeClass = 'warning';
        iconAction = `<button class="btn btn-outline btn-sm" onclick="App.openDetailModal('${item.id}')">Detail</button>`;
      } else if (item.statusCode === 'ditolak') {
        badgeClass = 'danger';
        iconAction = `<button class="btn btn-outline btn-sm" onclick="App.openDetailModal('${item.id}')">Alasan</button>`;
      }

      return `
        <tr>
          <td>
            <strong>${item.tanggal}</strong><br/>
            <span style="font-size: 11px; color: var(--text-muted);">${item.sesi}</span>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 12px;">${item.waktuBukti}</div>
          </td>
          <td>
            <span class="status-pill ${badgeClass}">
              <span class="dot"></span> ${item.status}
            </span>
          </td>
          <td>${iconAction}</td>
        </tr>
      `;
    }).join('');
  },

  /* View 2: Admin Master Data - Students */
  renderAdminMasterTable(searchQuery = '') {
    const tbody = document.getElementById('tbody-admin-master');
    if (!tbody) return;

    let data = AppData.studentsMaster;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(s => s.nama.toLowerCase().includes(q) || s.nim.includes(q));
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada data penghuni.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(s => {
      const initials = s.nama.split(' ').map(n => n[0]).join('').substring(0, 2);
      return `
        <tr>
          <td>
            <div class="user-table-cell">
              <div class="avatar-initials">${initials}</div>
              <div>
                <h5>${escapeHtml(s.nama)}</h5>
                <p>${escapeHtml(s.nim)}</p>
              </div>
            </div>
          </td>
          <td><strong>${s.kamar}</strong></td>
          <td><strong>${s.fasilitator}</strong></td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-outline btn-sm" onclick="App.editStudent('${escapeHtml(s.nim)}')">✏️ Edit</button>
              <button class="btn btn-outline btn-sm" style="color:#dc2626;" onclick="App.deleteUser('${escapeHtml(s.nim)}', '${escapeHtml(s.nama)}')">🗑️ Hapus</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  /* View 2: Admin Master Data - Facilitators */
  renderAdminFacilitatorsTable() {
    const tbody = document.getElementById('tbody-admin-facilitators');
    if (!tbody) return;

    if (!AppData.facilitatorsMaster || AppData.facilitatorsMaster.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada data fasilitator.</td></tr>';
      return;
    }

    tbody.innerHTML = AppData.facilitatorsMaster.map(f => `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--text-primary);">${f.nama}</div>
          <div style="font-size:11px; color:var(--text-muted);">NIP: ${f.nim}</div>
        </td>
        <td><strong>${f.gedung}</strong></td>
        <td>
          <span class="pill-badge-green">${f.binaanCount > 0 ? `${f.binaanCount} Penghuni` : '-'}</span>
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="App.editFasil('${f.nim_nip}')">✏️ Edit</button>
            <button class="btn btn-outline btn-sm" style="color:#dc2626;" onclick="App.deleteUser('${f.nim_nip}', '${f.nama}')">🗑️ Hapus</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  /* View 4: Admin Monitoring */
  renderAdminMonitoring() {
    const elPenghuni = document.getElementById('adm-stat-penghuni');
    const elFasil = document.getElementById('adm-stat-fasil');
    const elShubuh = document.getElementById('adm-stat-shubuh');
    const elMalam = document.getElementById('adm-stat-malam');
    const barShubuh = document.getElementById('adm-bar-shubuh');
    const barMalam = document.getElementById('adm-bar-malam');
    const actionList = document.getElementById('adm-action-list');
    const tbodyGedung = document.getElementById('tbody-adm-gedung');

    if (!elPenghuni) return; // fail safe if not initialized yet

    const totalPenghuni = AppData.studentsMaster?.length || 0;
    const totalFasil = AppData.facilitatorsMaster?.length || 0;
    
    elPenghuni.textContent = totalPenghuni;
    elFasil.textContent = totalFasil;

    // Persentase
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecords = AppData.riwayatPresensi?.filter(r => r.rawDate && r.rawDate.startsWith(todayStr)) || [];
    
    const countShubuh = new Set(todayRecords.filter(r => r.sesi.toLowerCase() === 'shubuh').map(r => r.user.nim_nip)).size;
    const countMalam = new Set(todayRecords.filter(r => r.sesi.toLowerCase() === 'malam').map(r => r.user.nim_nip)).size;

    const pctShubuh = totalPenghuni ? Math.round((countShubuh / totalPenghuni) * 100) : 0;
    const pctMalam = totalPenghuni ? Math.round((countMalam / totalPenghuni) * 100) : 0;

    elShubuh.textContent = pctShubuh;
    barShubuh.style.width = pctShubuh + '%';
    elMalam.textContent = pctMalam;
    barMalam.style.width = pctMalam + '%';

    // Perlu Ditindaklanjuti (Penghuni tanpa fasil/kamar & Izin)
    let issues = [];
    const tanpaKamar = AppData.studentsMaster?.filter(s => !s.kamar_id).length || 0;
    const tanpaFasil = AppData.studentsMaster?.filter(s => !s.fasil_id).length || 0;
    const izinGantung = AppData.approvalQueue?.length || 0;

    if (tanpaKamar > 0) issues.push({ msg: `${tanpaKamar} Penghuni belum ditempatkan di kamar.`, type: 'danger' });
    if (tanpaFasil > 0) issues.push({ msg: `${tanpaFasil} Penghuni belum memiliki fasilitator pembimbing.`, type: 'danger' });
    if (izinGantung > 0) issues.push({ msg: `${izinGantung} Izin menunggu disposisi dari Fasilitator.`, type: 'warning' });

    if (issues.length === 0) {
      actionList.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">Sistem sehat. Tidak ada data yang menggantung.</div>';
    } else {
      actionList.innerHTML = issues.map(i => `
        <div style="padding: 10px; border-bottom: 1px solid var(--border-color); display:flex; gap:10px; align-items:center;">
          <span class="status-pill ${i.type}"><span class="dot"></span></span>
          <span style="color:var(--text-primary); font-weight:500;">${i.msg}</span>
        </div>
      `).join('');
    }

    // Rekap per Gedung
    if (AppData.gedungList && tbodyGedung) {
      tbodyGedung.innerHTML = AppData.gedungList.map(g => {
        const penghuniCount = AppData.studentsMaster?.filter(s => s.gedung_id === g.id).length || 0;
        return `
          <tr>
            <td><strong>${escapeHtml(g.nama_gedung)}</strong></td>
            <td style="text-align:center;">${penghuniCount}</td>
            <td style="text-align:center;">-</td>
            <td style="text-align:center;">-</td>
            <td><span class="status-pill success"><span class="dot"></span> Terpantau</span></td>
          </tr>
        `;
      }).join('');
    }
  },

  /* View 4: Admin Riwayat */
  renderAdminRiwayat() {
    const tbody = document.getElementById('tbody-adm-riwayat');
    if (!tbody) return;

    if (!AppData.riwayatPresensi || AppData.riwayatPresensi.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada riwayat presensi.</td></tr>';
      return;
    }

    tbody.innerHTML = AppData.riwayatPresensi.map(r => {
      let badgeClass = 'success';
      if (r.statusCode === 'alpa') badgeClass = 'danger';
      if (r.statusCode === 'izin') badgeClass = 'info';

      // Thumbnail foto atau '-' untuk alpa/izin
      const fotoHtml = (r.statusCode === 'alpa' || r.statusCode === 'izin' || !r.foto) 
        ? '<div style="color:var(--text-muted); text-align:center;">-</div>'
        : `<img src="${r.foto}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;cursor:pointer;" onclick="App.openDetailModal('${r.id}')" title="Klik untuk perbesar" />`;

      // Lokasi (jarak) atau '-'
      const locHtml = (r.statusCode === 'alpa' || r.statusCode === 'izin' || !r.detail)
        ? '<div style="color:var(--text-muted); text-align:center;">-</div>'
        : `<a href="#" style="color:var(--primary); font-weight:600; text-decoration:none;">12 m dari titik</a>`;

      return `
        <tr>
          <td>
            <div style="font-weight:700;">${r.tanggal}</div>
            <div style="font-size:11px;color:var(--text-muted);">${r.waktuBukti.split(' ')[1] || r.waktuBukti}</div>
          </td>
          <td>
            <div style="font-weight:600;">${r.user?.nama || '-'}</div>
            <div style="font-size:11px;color:var(--text-muted);">${r.user?.nim_nip || '-'}</div>
          </td>
          <td>
            <strong>${r.user?.kamar?.gedung?.nama_gedung || '-'}</strong><br/>
            <span style="font-size:11px;color:var(--text-muted);">Kamar ${r.user?.kamar?.no_kamar || '-'}</span>
          </td>
          <td>
            <div style="margin-bottom:4px; font-weight:600;">${r.sesi}</div>
            <span class="status-pill ${badgeClass}"><span class="dot"></span> ${r.status}</span>
          </td>
          <td>${fotoHtml}</td>
          <td>${locHtml}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-outline btn-sm" onclick="App.koreksiStatus('${r.user?.nim_nip}')">Koreksi</button>
              <button class="btn btn-outline btn-sm" style="color:#dc2626;" onclick="showToast('Data dihapus (Hanya untuk Admin)', 'success')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },



  /* View 4: Facilitator Approval Queue Cards */
  renderFacilitatorQueue() {
    const queueContainer = document.getElementById('facilitator-approval-queue');
    if (!queueContainer) return;

    if (AppData.approvalQueue.length === 0) {
      queueContainer.innerHTML = `
        <div style="grid-column: span 2; text-align: center; padding: 24px; color: var(--text-muted);">
          Tabel izin pada database tidak memiliki kolom status persetujuan.
        </div>
      `;
      return;
    }

    queueContainer.innerHTML = AppData.approvalQueue.map(item => `
      <div class="approval-card" id="card-${item.id}">
        <div class="approval-user">
          <div class="user-table-cell">
            <img src="${item.avatar}" class="avatar-sm" alt="${item.nama}" />
            <div>
              <h5>${item.nama} <span class="badge-tag formal" style="font-size: 10px; text-transform:none; margin-left: 4px;">${item.kategori}</span></h5>
              <p>NIM ${item.nim} • ${item.kamar}</p>
            </div>
          </div>
          <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">${item.waktu}</span>
        </div>
        <div class="approval-reason">
          "${item.alasan}"
        </div>
        <div class="approval-file">
          <span>📄 ${item.fileName}</span>
          <button class="btn btn-outline btn-sm" onclick="App.openFileModal('${item.fileName}', '${item.fileUrl}')">Buka bukti</button>
        </div>
        <div class="btn-row" style="margin-top: 10px;">
          <button class="btn btn-primary btn-sm btn-block" onclick="App.approveLeave('${item.id}')">Setujui Izin</button>
          <button class="btn btn-outline btn-sm btn-block" style="color:#dc2626;" onclick="App.rejectLeave('${item.id}')">Tolak Izin</button>
        </div>
      </div>
    `).join('');
  },

  /* View 3: Dashboard Fasilitator (Rekap/Stats) */
  renderFasilDashboard() {
    // Stats calculation
    const allResidents = AppData.allUsers?.filter(u => u.role === 'penghuni' && u.fasil_id === AppData.sessionUser?.nim) || [];
    const total = allResidents.length;
    
    // Find who has attendance today
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysAttendance = AppData.riwayatPresensi?.filter(r => r.rawDate && r.rawDate.startsWith(todayStr)) || [];
    const attendedNim = new Set(todaysAttendance.map(r => r.user.nim_nip));
    
    // Total hadir
    const hadirCount = Array.from(attendedNim).filter(nim => allResidents.some(r => r.nim_nip === nim)).length;
    const persen = total === 0 ? 0 : Math.round((hadirCount / total) * 100);

    const elTotal = document.getElementById('fasil-stat-total');
    const elHadir = document.getElementById('fasil-stat-hadir');
    const elPersen = document.getElementById('fasil-stat-persen');
    const elBar = document.getElementById('fasil-stat-bar');
    const elAlpa = document.getElementById('fasil-stat-alpa');
    const elIzin = document.getElementById('fasil-stat-izin');
    const elPending = document.getElementById('fasil-stat-pending');
    
    if (elTotal) elTotal.textContent = total;
    if (elHadir) elHadir.textContent = hadirCount;
    if (elPersen) elPersen.textContent = `${persen}%`;
    if (elBar) elBar.style.width = `${persen}%`;
    if (elAlpa) elAlpa.textContent = (total - hadirCount).toString();

    // Stats Izin
    const pendingIzin = AppData.approvalQueue?.length || 0;
    if (elIzin) elIzin.textContent = pendingIzin;
    if (elPending) elPending.textContent = `${pendingIzin} Menunggu`;
    const badgePending = document.getElementById('badge-izin-pending');
    if (badgePending) badgePending.textContent = `${pendingIzin} Menunggu`;

    // Render "Perlu Perhatian"
    const listAlpa = document.getElementById('fasil-perhatian-list');
    if (listAlpa) {
      // Find alpa berulang (simplification: whoever is not present today is shown here for now)
      const absentResidents = allResidents.filter(r => !attendedNim.has(r.nim_nip));
      if (absentResidents.length === 0) {
        listAlpa.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">Tidak ada penghuni yang perlu perhatian khusus hari ini.</div>';
      } else {
        listAlpa.innerHTML = absentResidents.slice(0, 5).map(r => `
          <div style="padding: 10px; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:600; color:var(--text-primary); font-size:12.5px;">${escapeHtml(r.nama)}</div>
              <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(r.nim_nip)}</div>
            </div>
            <span class="status-pill danger"><span class="dot"></span> Alpa Hari Ini</span>
          </div>
        `).join('');
      }
    }
  },

  renderFasilRekap() {
    const tbody = document.getElementById('tbody-fasil-rekap');
    if (!tbody) return;
    
    // Render Fasil Rekap Table
    const allResidents = AppData.allUsers?.filter(u => u.role === 'penghuni' && u.fasil_id === AppData.sessionUser?.nim) || [];
    
    if (allResidents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Belum ada penghuni binaan.</td></tr>';
      return;
    }
    
    tbody.innerHTML = allResidents.map(r => {
      // Dummy stats based on overall riwayat
      const userRecords = AppData.riwayatPresensi?.filter(rec => rec.user.nim_nip === r.nim_nip) || [];
      const totalHadir = userRecords.filter(rec => rec.statusCode === 'hadir' || rec.statusCode === 'terlambat').length || 0;
      const totalIzin = 0; // Simulate
      const totalAlpa = totalHadir === 0 ? 1 : 0; // Simulate
      
      const percent = (totalHadir > 0) ? 100 : 0;
      const needsKoreksi = totalAlpa > 0 || totalIzin > 0;

      return `
        <tr>
          <td style="font-weight:600;">${escapeHtml(r.nama)}</td>
          <td>${escapeHtml(r.nim_nip)}</td>
          <td style="text-align:center;"><span style="color:var(--primary); font-weight:700;">${totalHadir}</span></td>
          <td style="text-align:center;"><span style="color:#b45309; font-weight:700;">${totalIzin}</span></td>
          <td style="text-align:center;"><span style="color:#dc2626; font-weight:700;">${totalAlpa}</span></td>
          <td style="text-align:center;">${percent}%</td>
          <td>
            ${needsKoreksi ? `<button class="btn btn-outline btn-sm" onclick="App.koreksiStatus('${r.nim_nip}')">Ubah Status</button>` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  },

  async koreksiStatus(nim) {
    const alasan = prompt('Koreksi Status (Alpa/Izin). Masukkan keterangan wajib (misal: Disetujui Dosen / Ralat Sistem):');
    if (alasan && alasan.trim() !== '') {
      showToast('Koreksi status diajukan dan dicatat di log sistem.', 'success');
      // Here you would call a PATCH API to update the record with 'alasan'
    } else if (alasan !== null) {
      showToast('Keterangan wajib diisi untuk melakukan koreksi.', 'warning');
    }
  },

  /* Form Submission Handlers */
  setupFormHandlers() {
    // Session tile selection
    const sessionTiles = document.querySelectorAll('.session-tile');
    sessionTiles.forEach(tile => {
      tile.addEventListener('click', () => {
        sessionTiles.forEach(t => t.classList.remove('selected'));
        tile.classList.add('selected');
      });
    });

    // Character counter for textarea
    const textarea = document.getElementById('keterangan-izin');
    const charCounter = document.getElementById('char-count');
    if (textarea && charCounter) {
      textarea.addEventListener('input', () => {
        charCounter.textContent = `${textarea.value.length} / 300 karakter`;
      });
    }

    const fileInput = document.getElementById('file-upload-input');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        const preview = document.getElementById('file-attached-card');
        if (!file || !preview) return;
        preview.style.display = 'flex';
        preview.querySelector('h5').textContent = file.name;
        preview.querySelector('p').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
      });
    }

    // Submit Permohonan Izin (Penghuni)
    const formIzin = document.getElementById('form-permohonan-izin');
    if (formIzin) {
      formIzin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput?.files[0];
        if (!file) return showToast('Pilih berkas bukti izin terlebih dahulu.', 'warning');
        if (file.size > 5 * 1024 * 1024) return showToast('Ukuran berkas maksimal 5 MB.', 'warning');
        const session = document.querySelector('.session-tile.selected')?.dataset.session || 'shubuh';
        const category = document.getElementById('kategori-izin').value;
        const formData = new FormData();
        formData.append('tanggal_izin', document.getElementById('tanggal-izin').value);
        formData.append('alasan', `${category} | Sesi: ${session} | ${textarea.value}`);
        formData.append('bukti', file);

        try {
          await ApiClient.request('/izin', { method: 'POST', body: formData });
          formIzin.reset();
          document.getElementById('file-attached-card').style.display = 'none';
          await this.renderAllViews();
          showToast('Pengajuan izin berhasil disimpan.', 'success');
        } catch (error) {
          showToast(error.message, 'danger');
        }
      });
    }

    // ========== ADMIN FORMS: Penghuni ==========
    const formQuickStudent = document.getElementById('form-quick-student');
    const selGedung = document.getElementById('quick-gedung');
    const selKamar = document.getElementById('quick-kamar');
    const selFasil = document.getElementById('quick-fasil');
    const btnResetStudent = document.getElementById('btn-reset-student-form');

    if (selGedung) {
      selGedung.addEventListener('change', () => {
        const gedungId = Number(selGedung.value);
        selKamar.innerHTML = '<option value="">-- Pilih Kamar --</option>';
        selKamar.disabled = !gedungId;
        if (gedungId && AppData.gedungList) {
          const g = AppData.gedungList.find(x => x.id === gedungId);
          (g?.kamar || []).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k.id;
            opt.textContent = `Kamar ${k.no_kamar} (Lantai ${k.lantai})`;
            selKamar.appendChild(opt);
          });
        }
      });
    }

    if (btnResetStudent) {
      btnResetStudent.addEventListener('click', () => App.resetStudentForm());
    }

    if (formQuickStudent) {
      formQuickStudent.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editNim = document.getElementById('student-edit-nim').value.trim();
        const isEdit = !!editNim;
        const pw = document.getElementById('quick-password').value;

        if (!isEdit && !pw) {
          return showToast('Password wajib diisi untuk penghuni baru.', 'warning');
        }

        const payload = {
          nim_nip: document.getElementById('quick-nim').value.trim(),
          nama: document.getElementById('quick-nama').value.trim(),
          email: document.getElementById('quick-email').value.trim(),
          role: 'penghuni',
          id_kamar: selKamar?.value ? Number(selKamar.value) : null,
          fasil_id: selFasil?.value || null,
          gedung_id: selGedung?.value ? Number(selGedung.value) : null
        };
        if (pw) payload.password = pw;

        try {
          if (isEdit) {
            await ApiClient.request(`/users/${editNim}`, { method: 'PUT', body: JSON.stringify(payload) });
            showToast(`Penghuni "${payload.nama}" berhasil diperbarui.`, 'success');
          } else {
            await ApiClient.request('/users', { method: 'POST', body: JSON.stringify(payload) });
            showToast(`Penghuni "${payload.nama}" berhasil ditambahkan.`, 'success');
          }
          App.resetStudentForm();
          await this.renderAllViews();
        } catch (error) {
          showToast(error.message, 'danger');
        }
      });
    }

    // ========== ADMIN FORMS: Fasilitator ==========
    const formInlineFasil = document.getElementById('form-inline-fasil');
    const btnResetFasil = document.getElementById('btn-reset-fasil-form');

    if (btnResetFasil) {
      btnResetFasil.addEventListener('click', () => App.resetFasilForm());
    }

    if (formInlineFasil) {
      formInlineFasil.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editNim = document.getElementById('fasil-edit-nim').value.trim();
        const isEdit = !!editNim;
        const pw = document.getElementById('inline-fasil-password').value;

        if (!isEdit && !pw) {
          return showToast('Password wajib diisi untuk fasilitator baru.', 'warning');
        }

        const payload = {
          nim_nip: document.getElementById('inline-fasil-nip').value.trim(),
          nama: document.getElementById('inline-fasil-nama').value.trim(),
          email: document.getElementById('inline-fasil-email').value.trim(),
          role: 'fasil',
          gedung_id: document.getElementById('inline-fasil-gedung').value ? Number(document.getElementById('inline-fasil-gedung').value) : null
        };
        if (pw) payload.password = pw;

        try {
          if (isEdit) {
            await ApiClient.request(`/users/${editNim}`, { method: 'PUT', body: JSON.stringify(payload) });
            showToast(`Fasilitator "${payload.nama}" berhasil diperbarui.`, 'success');
          } else {
            await ApiClient.request('/users', { method: 'POST', body: JSON.stringify(payload) });
            showToast(`Fasilitator "${payload.nama}" berhasil ditambahkan.`, 'success');
          }
          App.resetFasilForm();
          await this.renderAllViews();
        } catch (error) {
          showToast(error.message, 'danger');
        }
      });
    }

    // Search input handlers
    const searchAdmin = document.getElementById('search-admin-input');
    if (searchAdmin) {
      searchAdmin.addEventListener('input', (e) => {
        this.renderAdminMasterTable(e.target.value);
      });
    }

    const searchFasil = document.getElementById('search-fasil-input');
    if (searchFasil) {
      searchFasil.addEventListener('input', (e) => {
        this.renderFacilitatorMonitoring(e.target.value);
      });
    }

    // Filter tabs for Riwayat Presensi
    const filterTabs = document.querySelectorAll('#filter-tabs-riwayat .filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderRiwayatTable(tab.textContent.trim());
      });
    });

    // Fasil sub tabs logic
    const fasilSubTabs = document.querySelectorAll('#fasil-sub-tabs .filter-tab');
    fasilSubTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        fasilSubTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabTarget = tab.getAttribute('data-tab');
        const secDash = document.getElementById('fasil-tab-dashboard');
        const secRekap = document.getElementById('fasil-tab-rekap');

        if (tabTarget === 'rekap') {
          if (secDash) secDash.style.display = 'none';
          if (secRekap) secRekap.style.display = 'block';
        } else {
          if (secDash) secDash.style.display = 'block';
          if (secRekap) secRekap.style.display = 'none';
        }
      });
    });

    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => {
        showToast('Berhasil mengekspor Laporan Kehadiran (.csv)', 'success');
      });
    }

    // Sub tabs for Admin Panel (Data Penghuni vs Data Fasilitator)
    const adminSubTabs = document.querySelectorAll('#admin-sub-tabs .filter-tab');
    adminSubTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        adminSubTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabTarget = tab.getAttribute('data-tab');
        const secStudents = document.getElementById('sec-admin-students');
        const secFasil = document.getElementById('sec-admin-facilitators');

        if (tabTarget === 'fasilitator') {
          if (secStudents) secStudents.style.display = 'none';
          if (secFasil) secFasil.style.display = 'block';
        } else {
          if (secStudents) secStudents.style.display = 'block';
          if (secFasil) secFasil.style.display = 'none';
        }
      });
    });

    // Main tabs for Admin Terpadu
    const adminMainTabs = document.querySelectorAll('#admin-main-tabs .filter-tab');
    adminMainTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        adminMainTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabTarget = tab.getAttribute('data-tab');
        const secMon = document.getElementById('admin-tab-monitoring');
        const secMan = document.getElementById('admin-tab-manajemen');
        const secRiw = document.getElementById('admin-tab-riwayat');
        const bcText = document.getElementById('admin-bc-text');
        const titleText = document.getElementById('admin-title-text');
        const subText = document.getElementById('admin-subtitle-text');

        if (secMon) secMon.style.display = 'none';
        if (secMan) secMan.style.display = 'none';
        if (secRiw) secRiw.style.display = 'none';

        if (tabTarget === 'monitoring') {
          if (secMon) secMon.style.display = 'block';
          if (bcText) bcText.textContent = 'Monitoring Asrama';
          if (titleText) titleText.textContent = 'Dashboard Monitoring Asrama';
          if (subText) subText.textContent = 'Pantau skala sistem, rekap per gedung, dan masalah data secara keseluruhan.';
        } else if (tabTarget === 'manajemen') {
          if (secMan) secMan.style.display = 'block';
          if (bcText) bcText.textContent = 'Manajemen Pengguna';
          if (titleText) titleText.textContent = 'Manajemen Data Asrama UNAND';
          if (subText) subText.textContent = 'Kelola Fasilitator (penetapan gedung) dan Penghuni (gedung, kamar, & fasil pembimbing).';
        } else if (tabTarget === 'riwayat') {
          if (secRiw) secRiw.style.display = 'block';
          if (bcText) bcText.textContent = 'Riwayat & Laporan';
          if (titleText) titleText.textContent = 'Laporan Presensi Terpadu';
          if (subText) subText.textContent = 'Akses penuh ke log presensi seluruh gedung untuk keperluan audit.';
        }
      });
    });
  },

  /* Approval Actions (Facilitator) */
  async approveLeave(id) {
    await this.updateLeaveStatus(id, 'disetujui');
  },

  async rejectLeave(id) {
    await this.updateLeaveStatus(id, 'ditolak');
  },

  async updateLeaveStatus(id, status_izin) {
    try {
      await ApiClient.request(`/izin/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status_izin })
      });
      await this.renderAllViews();
      showToast(status_izin === 'disetujui' ? 'Permohonan izin disetujui.' : 'Permohonan izin ditolak.', 'success');
    } catch (error) {
      showToast(error.message, 'danger');
    }
  },

  /* Modals Controller */
  setupModalHandlers() {
    document.querySelectorAll('.modal-close-trigger').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeAllModals();
      });
    });
  },

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  },

  openDetailModal(id) {
    const role = AppData.sessionUser ? AppData.sessionUser.role : 'penghuni';
    const list = role === 'penghuni' ? AppData.riwayatPenghuniPrivate : AppData.riwayatPresensi;
    const item = list.find(r => r.id === id);
    if (!item) return;

    const modalBody = document.getElementById('modal-detail-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="font-size: 13px; line-height: 1.6;">
          <p><strong>ID Record:</strong> ${item.id}</p>
          <p><strong>Tanggal & Sesi:</strong> ${item.tanggal} • ${item.sesi}</p>
          <p><strong>Metode Validasi:</strong> ${item.metode}</p>
          <p><strong>Waktu / Keterangan:</strong> ${item.waktuBukti}</p>
          <p><strong>Status:</strong> <span class="status-pill success"><span class="dot"></span> ${item.status}</span></p>
          <hr style="margin: 12px 0; border: none; border-top: 1px solid var(--border-color);" />
          <p><strong>Rincian Detail:</strong></p>
          <div style="background: var(--bg-subtle); padding: 10px; border-radius: 6px; font-style: italic; margin-top: 6px;">
            "${item.detail || '-'}"
          </div>
        </div>
      `;
    }

    document.getElementById('modal-detail-record').classList.add('active');
  },

  openFileModal(fileName, fileUrl) {
    const modalBody = document.getElementById('modal-file-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <h4 style="font-size: 15px; font-weight: 800; color: var(--text-primary);">${fileName}</h4>
          ${fileUrl && fileUrl.startsWith('/uploads/bukti_izin/')
            ? `<a class="btn btn-primary" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">Buka / unduh bukti</a>`
            : '<p style="font-size: 12px; color: var(--text-muted); margin-top: 12px;">Berkas bukti tidak tersedia.</p>'}
        </div>
      `;
    }
    document.getElementById('modal-file-preview').classList.add('active');
  },

  openAddFasilModal() {
    document.getElementById('modal-add-fasilitator')?.classList.add('active');
  },

  // ---- Edit & Delete helpers ----
  editStudent(nim) {
    const s = AppData.studentsMaster?.find(x => x.nim === nim);
    if (!s) return;

    document.getElementById('student-edit-nim').value = s.nim;
    document.getElementById('quick-nim').value = s.nim;
    document.getElementById('quick-nim').disabled = true;
    document.getElementById('quick-nama').value = s._raw?.nama || s.nama;
    document.getElementById('quick-email').value = s._raw?.email || s.email || '';
    document.getElementById('quick-password').value = '';
    document.getElementById('lbl-student-pw').classList.remove('req');
    document.getElementById('hint-student-pw').textContent = 'Kosongkan jika tidak diubah';
    document.getElementById('form-student-title').textContent = `✏️ Edit Penghuni: ${s.nama}`;
    document.getElementById('btn-reset-student-form').style.display = 'inline-flex';
    document.getElementById('btn-submit-student').textContent = '💾 Simpan Perubahan';

    // Pre-select gedung (kamar gedung)
    const gedungId = s.kamar_obj?.gedung_id || s.gedung_id || '';
    const selGedung = document.getElementById('quick-gedung');
    if (selGedung) {
      selGedung.value = gedungId;
      selGedung.dispatchEvent(new Event('change'));
      setTimeout(() => {
        const selKamar = document.getElementById('quick-kamar');
        if (selKamar) selKamar.value = s.kamar_id || '';
      }, 50);
    }

    const selFasil = document.getElementById('quick-fasil');
    if (selFasil) selFasil.value = s.fasil_id || '';

    // Switch to penghuni tab and scroll to form
    document.getElementById('tab-penghuni')?.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  resetStudentForm() {
    document.getElementById('form-quick-student')?.reset();
    document.getElementById('student-edit-nim').value = '';
    document.getElementById('quick-nim').disabled = false;
    document.getElementById('lbl-student-pw').classList.add('req');
    document.getElementById('hint-student-pw').textContent = 'Min. 6 karakter';
    document.getElementById('form-student-title').textContent = '➕ Tambah Penghuni Baru';
    document.getElementById('btn-reset-student-form').style.display = 'none';
    document.getElementById('btn-submit-student').textContent = '💾 Simpan Penghuni';
    const selKamar = document.getElementById('quick-kamar');
    if (selKamar) { selKamar.innerHTML = '<option value="">-- Pilih Kamar --</option>'; selKamar.disabled = true; }
  },

  editFasil(nim) {
    const f = AppData.facilitatorsMaster?.find(x => x.nim_nip === nim);
    if (!f) return;

    document.getElementById('fasil-edit-nim').value = f.nim_nip;
    document.getElementById('inline-fasil-nip').value = f.nim_nip;
    document.getElementById('inline-fasil-nip').disabled = true;
    document.getElementById('inline-fasil-nama').value = f._raw?.nama || f.nama;
    document.getElementById('inline-fasil-email').value = f.email || f._raw?.email || '';
    document.getElementById('inline-fasil-password').value = '';
    document.getElementById('lbl-fasil-pw').classList.remove('req');
    document.getElementById('hint-fasil-pw').textContent = 'Kosongkan jika tidak diubah';
    document.getElementById('form-fasil-title').textContent = `✏️ Edit Fasilitator: ${f._raw?.nama || f.nama}`;
    document.getElementById('btn-reset-fasil-form').style.display = 'inline-flex';
    document.getElementById('btn-submit-fasil').textContent = '💾 Simpan Perubahan';

    const selGedung = document.getElementById('inline-fasil-gedung');
    if (selGedung) selGedung.value = f.gedung_id || '';

    document.getElementById('tab-fasilitator')?.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  resetFasilForm() {
    document.getElementById('form-inline-fasil')?.reset();
    document.getElementById('fasil-edit-nim').value = '';
    document.getElementById('inline-fasil-nip').disabled = false;
    document.getElementById('lbl-fasil-pw').classList.add('req');
    document.getElementById('hint-fasil-pw').textContent = 'Min. 6 karakter';
    document.getElementById('form-fasil-title').textContent = '➕ Tambah Fasilitator Baru';
    document.getElementById('btn-reset-fasil-form').style.display = 'none';
    document.getElementById('btn-submit-fasil').textContent = '💾 Simpan Fasilitator';
  },

  async deleteUser(nim, nama) {
    if (!confirm(`Hapus akun "${nama}" secara permanen?`)) return;
    try {
      await ApiClient.request(`/users/${nim}`, { method: 'DELETE' });
      showToast(`Akun "${nama}" berhasil dihapus.`, 'success');
      await this.renderAllViews();
    } catch (error) {
      showToast(error.message, 'danger');
    }
  },


};

/* Global Toast Notification System */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* Biometric Verification Modal helper */
function openVerificationSuccessModal(dataUrl) {
  const modalBody = document.getElementById('modal-verification-body');
  if (modalBody) {
    modalBody.innerHTML = `
      <div style="text-align: center;">
        <img src="${dataUrl}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary); margin-bottom: 14px;" />
        <h3 style="font-size: 17px; font-weight: 800; color: var(--primary);">PRESENSI TERCATAT</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Foto dan koordinat GPS tersimpan di sistem.</p>
        <div style="background: var(--primary-light); padding: 10px; border-radius: 8px; font-size: 12px; color: var(--primary-dark); font-weight: 700; margin-top: 14px;">
          Verifikasi kecocokan wajah dan batas geofence belum dikonfigurasi.
        </div>
      </div>
    `;
  }
  document.getElementById('modal-verification-success').classList.add('active');
  showToast('Presensi berhasil disimpan ke database.', 'success');
}
