/**
 * AuthContext — holds the current user + JWT, exposes login/logout.
 *
 * On mount, if a token exists in localStorage, fetches /auth/me to validate
 * it and load the user. If the token is invalid/expired, clears it.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { getToken, setToken } from '../../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: validate any existing token.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setToken(''))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((token, userObj) => {
    setToken(token);
    setUser(userObj);
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
  }, []);

  const refreshUser = useCallback(() => {
    return api.get('/auth/me')
      .then((data) => { setUser(data.user); return data.user; })
      .catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
