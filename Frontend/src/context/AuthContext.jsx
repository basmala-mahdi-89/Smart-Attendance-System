import { createContext, useContext, useState, useEffect } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the cached session instantly, then refresh the full profile
  // (major, academic year, phone…) from the API so the identity card is always complete.
  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      let cached = null;
      if (savedUser) {
        try {
          cached = JSON.parse(savedUser);
          if (mounted) setUser(cached);
        } catch {
          localStorage.removeItem('user');
        }
      }

      try {
        const fresh = await authApi.getMe();
        if (!mounted) return;
        // A newer sign-in may have replaced the token while this request was in flight.
        if (localStorage.getItem('token') !== token) return;
        const merged = { ...cached, ...fresh };
        localStorage.setItem('user', JSON.stringify(merged));
        setUser(merged);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (mounted) setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    restore();
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (national_id, password, device_fingerprint = null, university_id = '') => {
    const data = await authApi.login(national_id, password, device_fingerprint, university_id);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const refreshUser = async () => {
    try {
      const fresh = await authApi.getMe();
      const merged = { ...(user || {}), ...fresh };
      localStorage.setItem('user', JSON.stringify(merged));
      setUser(merged);
      return merged;
    } catch {
      return user;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
