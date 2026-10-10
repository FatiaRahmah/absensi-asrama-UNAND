import { Navigate, Route, Routes } from 'react-router-dom';
import { HOME_BY_ROLE, useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Presensi from './pages/penghuni/Presensi.jsx';
import RiwayatPenghuni from './pages/penghuni/RiwayatPenghuni.jsx';
import FasilDashboard from './pages/fasil/FasilDashboard.jsx';
import FasilRekap from './pages/fasil/FasilRekap.jsx';
import FasilKalender from './pages/fasil/FasilKalender.jsx';
import AdminMonitoring from './pages/admin/AdminMonitoring.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminRiwayat from './pages/admin/AdminRiwayat.jsx';

function RoleRoute({ role, children }) {
  const { user } = useAuth();
  return user.role === role ? children : <Navigate to={HOME_BY_ROLE[user.role]} replace />;
}

export default function App() {
  const { user, booting } = useAuth();
  if (booting) return <Loading text="Memuat sesi..." />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={HOME_BY_ROLE[user.role]} replace />} />
      <Route element={<Layout />}>
        <Route path="/presensi" element={<RoleRoute role="penghuni"><Presensi /></RoleRoute>} />
        <Route path="/riwayat" element={<RoleRoute role="penghuni"><RiwayatPenghuni /></RoleRoute>} />

        <Route path="/fasil" element={<RoleRoute role="fasil"><FasilDashboard /></RoleRoute>} />
        <Route path="/fasil/rekap" element={<RoleRoute role="fasil"><FasilRekap /></RoleRoute>} />
        <Route path="/fasil/rekap/:nim" element={<RoleRoute role="fasil"><FasilKalender /></RoleRoute>} />

        <Route path="/admin" element={<RoleRoute role="admin"><AdminMonitoring /></RoleRoute>} />
        <Route path="/admin/pengguna" element={<RoleRoute role="admin"><AdminUsers /></RoleRoute>} />
        <Route path="/admin/riwayat" element={<RoleRoute role="admin"><AdminRiwayat /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={HOME_BY_ROLE[user.role]} replace />} />
    </Routes>
  );
}
