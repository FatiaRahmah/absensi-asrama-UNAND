import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const HOME_BY_ROLE = { penghuni: '/presensi', fasil: '/fasil', admin: '/admin' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    api.get('/auth/me')
      .then(result => setUser(result.user))
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, [logout]);

  const login = async (identifier, password) => {
    const result = await api.post('/auth/login', { identifier, password });
    setToken(result.token);
    setUser(result.user);
    return result.user;
  };

  return <AuthContext.Provider value={{ user, booting, login, logout }}>{children}</AuthContext.Provider>;
}
