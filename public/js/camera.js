/* ==========================================================================
   Portal Asrama UNAND - Biometric Camera & Time Session Validator
   ========================================================================== */

const CameraModule = {
  stream: null,
  isCameraActive: false,
  facingMode: 'user',

  init() {
    this.startClock();
    this.setupCameraControls();
  },

  // Live ticking clock with current session evaluator
  startClock() {
    const clockEl = document.getElementById('live-clock-time');
    const dateEl = document.getElementById('live-clock-date');
    const sessionBadgeEl = document.getElementById('live-session-badge');

    const updateTime = () => {
      const now = new Date();
      
      const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
      const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
      
      const dayName = days[now.getDay()];
      const dayNum = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();

      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      if (dateEl) {
        dateEl.textContent = `${dayName}, ${dayNum} ${monthName} ${year}`;
      }
      if (clockEl) {
        clockEl.textContent = `${hours}:${minutes}:${seconds} WIB`;
      }

      // Check current active session schedule:
      // Shubuh: 04.00 - 06.00 WIB | Malam: 18.00 - 20.30 WIB
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const shubuhStart = 4 * 60;        // 04:00
      const shubuhEnd = 6 * 60;          // 06:00
      const malamStart = 18 * 60;        // 18:00
      const malamEnd = 20 * 60 + 30;     // 20:30

      if (sessionBadgeEl) {
        if (currentMinutes >= shubuhStart && currentMinutes <= shubuhEnd) {
          sessionBadgeEl.className = 'pill-badge-green';
          sessionBadgeEl.textContent = '🟢 SESI SHUBUH BERLANGSUNG (04.00 - 06.00 WIB)';
        } else if (currentMinutes >= malamStart && currentMinutes <= malamEnd) {
          sessionBadgeEl.className = 'pill-badge-green';
          sessionBadgeEl.textContent = '🟢 SESI MALAM BERLANGSUNG (18.00 - 20.30 WIB)';
        } else {
          sessionBadgeEl.className = 'pill-badge-green';
          sessionBadgeEl.style.backgroundColor = '#fef3c7';
          sessionBadgeEl.style.color = '#b45309';
          sessionBadgeEl.textContent = '⏱️ DILUAR JADWAL PRESENSI (Shubuh: 04.00-06.00 | Malam: 18.00-20.30)';
        }
      }
    };

    updateTime();
    setInterval(updateTime, 1000);
  },

  // Initialize webcam feed
  async startWebcam() {
    const video = document.getElementById('webcam-video');
    const canvasPlaceholder = document.getElementById('webcam-canvas-fallback');
    
    if (!video) return;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: this.facingMode
          },
          audio: false
        });
        
        this.stream = stream;
        video.srcObject = stream;
        await video.play();
        this.isCameraActive = true;
        
        if (canvasPlaceholder) canvasPlaceholder.style.display = 'none';
        video.style.display = 'block';
        
        showToast("Kamera HD berhasil diaktifkan", "success");
      } else {
        throw new Error("Webcam tidak didukung");
      }
    } catch (err) {
      console.warn("Webcam fallback activation:", err);
      this.startSimulatedFeed();
    }
  },

  stopWebcam() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.isCameraActive = false;
    }
  },

  switchCamera() {
    this.stopWebcam();
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.startWebcam();
  },

  // Fallback simulated camera canvas animation
  startSimulatedFeed() {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('webcam-canvas-fallback');
    if (!canvas) return;

    if (video) video.style.display = 'none';
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');

    let frame = 0;
    const drawSimulation = () => {
      if (video && video.style.display === 'block') return;
      
      frame++;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 + Math.sin(frame * 0.05) * 4;

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - 10, 65, 85, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 120, 120, 70, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - 40, centerY - 30, 25, 15);
      ctx.strokeRect(centerX + 15, centerY - 30, 25, 15);
      ctx.strokeRect(centerX - 25, centerY + 20, 50, 15);

      requestAnimationFrame(drawSimulation);
    };

    drawSimulation();
  },

  // Capture Photo
  capturePhoto() {
    const video = document.getElementById('webcam-video');
    if (!this.isCameraActive || !video || video.readyState < 2) {
      showToast('Aktifkan kamera sebelum mengirim presensi.', 'warning');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg');

    const flashEl = document.getElementById('camera-flash');
    if (flashEl) {
      flashEl.style.opacity = '0.8';
      setTimeout(() => { flashEl.style.opacity = '0'; }, 200);
    }

    App.submitAttendance(dataUrl);
  },

  setupCameraControls() {
    const btnCapture = document.getElementById('btn-capture-photo');
    const btnSwitch = document.getElementById('btn-switch-camera');

    if (btnCapture) {
      btnCapture.addEventListener('click', () => this.capturePhoto());
    }
    if (btnSwitch) {
      btnSwitch.addEventListener('click', () => this.switchCamera());
    }
  }
};
