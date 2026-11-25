import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { PageHeader, StatusPill, useFetch, useToast } from '../../components/ui.jsx';
import { dateKey, SESI_LABEL, fmtMinutes, todayKey } from '../../utils.js';

const SCHEDULE = {
  subuh: { start: 240, end: 360, label: '04.00 - 06.00 WIB' },
  malam: { start: 1080, end: 1230, label: '18.00 - 20.30 WIB' }
};

function currentSession(now) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const key = Object.keys(SCHEDULE).find(k => minutes >= SCHEDULE[k].start && minutes <= SCHEDULE[k].end);
  if (key) return { key, sisa: SCHEDULE[key].end - minutes };
  const next = minutes < SCHEDULE.subuh.start ? 'subuh' : minutes < SCHEDULE.malam.start ? 'malam' : 'subuh';
  const target = SCHEDULE[next].start + (minutes > SCHEDULE.malam.end ? 1440 : 0);
  return { key: null, next, buka: target - minutes };
}

const getPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error('Perangkat tidak mendukung GPS'));
  navigator.geolocation.getCurrentPosition(
    pos => resolve(pos.coords),
    () => reject(new Error('Izinkan akses lokasi perangkat untuk melakukan presensi')),
    { enableHighAccuracy: true, timeout: 15000 }
  );
});

const localDateTimeInput = date => {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const nextDemoSession = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(4, 30, 0, 0);
  return localDateTimeInput(date);
};

export default function Presensi() {
  const toast = useToast();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState('user');
  const [cameraOn, setCameraOn] = useState(false);
  const [camError, setCamError] = useState('');
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const history = useFetch(() => api.get('/presensi'), []);
  const config = useFetch(() => api.get('/presensi/config'), []);
  const demoMode = config.data?.demoMode === true;
  const [simulatedAt, setSimulatedAt] = useState(nextDemoSession);
  const [simulatedSession, setSimulatedSession] = useState('subuh');
  const [simulatedGps, setSimulatedGps] = useState({ lat: '-0.9175609', long: '100.4539945' });
  const [demoToggleBusy, setDemoToggleBusy] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startCamera = useCallback(async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facing }, audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setCamError('');
    } catch {
      setCameraOn(false);
      setCamError('Kamera tidak dapat diakses. Izinkan akses kamera di browser Anda.');
    }
  }, [facing]);

  useEffect(() => {
    startCamera();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [startCamera]);

  const session = currentSession(demoMode && simulatedAt ? new Date(`${simulatedAt}:00+07:00`) : now);
  const activeSession = demoMode ? simulatedSession : session.key;
  const today = demoMode && simulatedAt ? simulatedAt.slice(0, 10) : todayKey();
  const todayRecords = (history.data?.records || []).filter(r =>
    r.tanggal === today && !String(r.keterangan || '').includes('DEMO')
  );
  const doneToday = !demoMode && activeSession && todayRecords.find(r => r.jenis_presensi === activeSession);

  const toggleDemoMode = async () => {
    const enabled = !demoMode;
    if (enabled && !window.confirm('Aktifkan mode demo? Presensi yang berhasil akan disimpan ke database dan ditandai DEMO.')) return;
    setDemoToggleBusy(true);
    try {
      await api.patch('/presensi/demo-mode', { enabled });
      if (enabled) {
        setSimulatedAt(nextDemoSession());
        setSimulatedSession('subuh');
      }
      toast(enabled ? 'Mode demo diaktifkan.' : 'Mode demo dinonaktifkan.');
      config.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDemoToggleBusy(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!cameraOn || !video || video.readyState < 2) return toast('Aktifkan kamera sebelum mengirim presensi.', 'warning');
    setBusy(true);
    try {
      const coords = demoMode
        ? { latitude: Number(simulatedGps.lat), longitude: Number(simulatedGps.long) }
        : await getPosition();
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
      await api.post('/presensi', {
        jenis_presensi: activeSession, lat: coords.latitude, long: coords.longitude,
        ...(demoMode ? { waktu_simulasi: simulatedAt } : {}), foto: canvas.toDataURL('image/jpeg', 0.85)
      });
      toast('Presensi berhasil dicatat.');
      history.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const week = (() => {
    const createdAt = user?.created_at ? new Date(user.created_at) : null;
    const accountAge = createdAt ? now.getTime() - createdAt.getTime() : 0;
    if (!createdAt || Number.isNaN(createdAt.getTime()) || accountAge < 24 * 60 * 60 * 1000) {
      return { hadir: 0, izin: 0, alpa: 0, total: 0, persen: 0 };
    }

    const since = new Date(now);
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const rows = (history.data?.records || []).filter(r =>
      !String(r.keterangan || '').includes('DEMO') &&
      r.tanggal >= dateKey(since) &&
      r.waktu_presensi &&
      new Date(r.waktu_presensi).getTime() >= createdAt.getTime() &&
      new Date(r.waktu_presensi).getTime() <= now.getTime()
    );
    const c = { hadir: 0, izin: 0, alpa: 0 };
    rows.forEach(r => { if (r.status === 'izin') c.izin++; else if (r.status === 'alpa') c.alpa++; else c.hadir++; });
    const total = c.hadir + c.izin + c.alpa;
    return { ...c, total, persen: total ? Math.round((c.hadir / total) * 100) : 0 };
  })();

  const disabled = busy || (!demoMode && !session.key) || Boolean(doneToday) || !cameraOn;
  let buttonText = 'Ambil Foto & Catat Kehadiran';
  if (!demoMode && !session.key) buttonText = `Di luar jadwal • Sesi ${SESI_LABEL[session.next]} dibuka ${fmtMinutes(session.buka)} lagi`;
  else if (doneToday) buttonText = `Sesi ${SESI_LABEL[activeSession]} sudah tercatat (${doneToday.status})`;

  return (
    <>
      <PageHeader title="Presensi Mandiri Kamera" subtitle="Pencatatan kehadiran dengan bukti foto dan lokasi perangkat.">
        <div className="clock-widget">
          <div className="clock-date">{now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div className="clock-time">{now.toLocaleTimeString('id-ID', { hour12: false })} WIB</div>
        </div>
        {config.data?.available && <button className={`btn ${demoMode ? 'btn-danger' : 'btn-outline'}`} disabled={demoToggleBusy} onClick={toggleDemoMode}>
          {demoToggleBusy ? 'Mengubah...' : demoMode ? 'Matikan Mode Demo' : 'Aktifkan Mode Demo'}
        </button>}
      </PageHeader>

      <div className={`session-banner ${session.key ? 'on' : 'off'}`}>
        {session.key
          ? <>🟢 <strong>Sesi {SESI_LABEL[session.key]} berlangsung</strong> ({SCHEDULE[session.key].label}) — ditutup dalam {fmtMinutes(session.sisa)}</>
          : <>⏱️ <strong>Di luar jadwal presensi.</strong> Sesi {SESI_LABEL[session.next]} dibuka dalam {fmtMinutes(session.buka)}</>}
      </div>

      <div className="grid-2">
        <div>
          <div className="card camera-card">
            {demoMode && <div className="card" style={{ marginBottom: 16, border: '1px solid var(--amber, #d99b00)' }}>
              <h3>Mode Demo Presensi</h3>
              <p className="muted small">Simulasi ini aktif dari konfigurasi server. Data yang berhasil dikirim akan tercatat sebagai presensi demo.</p>
              <label className="form-group"><span className="form-label">Waktu simulasi (WIB)</span>
                <input className="form-input" type="datetime-local" value={simulatedAt} onChange={e => setSimulatedAt(e.target.value)} required /></label>
              <label className="form-group"><span className="form-label">Sesi yang diuji</span>
                <select className="form-select" value={simulatedSession} onChange={e => setSimulatedSession(e.target.value)}>
                  <option value="subuh">Subuh (04.00–06.00)</option><option value="malam">Malam (18.00–20.30)</option>
                </select></label>
              <div className="btn-row">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setSimulatedGps({ lat: '-0.9175609', long: '100.4539945' })}>GPS dalam radius</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setSimulatedGps({ lat: '0', long: '0' })}>GPS luar radius</button>
              </div>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <label className="form-group"><span className="form-label">Latitude</span>
                  <input className="form-input" type="number" step="any" value={simulatedGps.lat} onChange={e => setSimulatedGps(g => ({ ...g, lat: e.target.value }))} /></label>
                <label className="form-group"><span className="form-label">Longitude</span>
                  <input className="form-input" type="number" step="any" value={simulatedGps.long} onChange={e => setSimulatedGps(g => ({ ...g, long: e.target.value }))} /></label>
              </div>
            </div>}
            <div className="camera-view">
              <video ref={videoRef} autoPlay playsInline muted className="mirror" />
              {!cameraOn && <div className="camera-placeholder">{camError || 'Mengaktifkan kamera...'}</div>}
              <div className="face-guide" />
            </div>
            <div className="btn-row">
              <button id="btn-capture" className="btn btn-primary grow" disabled={disabled} onClick={capture}>
                {busy ? 'Memproses...' : buttonText}
              </button>
              <button className="btn btn-outline" onClick={() => setFacing(f => (f === 'user' ? 'environment' : 'user'))}>Ganti Kamera</button>
            </div>
            <p className="muted small">Lokasi perangkat dan foto akan disimpan sebagai bukti. Presensi sah bila berada ≤ 30 m dari titik gedung.</p>
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Jadwal Sesi</h3>
            {Object.entries(SCHEDULE).map(([key, s]) => {
              const rec = todayRecords.find(r => r.jenis_presensi === key);
              return (
                <div key={key} className={`schedule-row ${session.key === key ? 'active' : ''}`}>
                  <div><strong>Sesi {SESI_LABEL[key]}</strong><div className="muted small">{s.label}</div></div>
                  {rec ? <StatusPill status={rec.status} /> : <span className="muted small">Belum tercatat</span>}
                </div>
              );
            })}
          </div>
          <div className="card">
            <h3>Rekap 7 Hari Terakhir</h3>
            <div className="gauge-row">
              <div className="gauge">{week.persen}%</div>
              <div><strong>{week.hadir} dari {week.total} sesi hadir</strong>
                <p className="muted small">Standar kehadiran minimal asrama 85%.</p></div>
            </div>
            <div className="mini-stats">
              <div><b className="c-green">{week.hadir}</b><span>Hadir</span></div>
              <div><b className="c-amber">{week.izin}</b><span>Izin</span></div>
              <div><b className="c-red">{week.alpa}</b><span>Alpa</span></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
