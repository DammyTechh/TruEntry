import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { tokenStore } from '../lib/api';

const AuthContext = createContext(null);

/**
 * /auth/me responds with { data: { user } } while /auth/login responds with
 * { data: { user, tokens } }. Unwrap both here so a restored session produces
 * exactly the same user object as a fresh sign-in — otherwise `user.role` is
 * undefined after a reload and every role-based redirect sends the person back
 * to the landing page.
 */
function unwrapUser(payload) {
  const d = payload?.data ?? payload;
  return d?.user ?? d ?? null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on load if we have a token.
  useEffect(() => {
    let active = true;

    // Safety net: never leave the app on a loading screen because a request
    // stalled. If the session check has not settled in time, stop waiting —
    // the guards will send the user to sign in rather than hanging.
    const bail = setTimeout(() => {
      if (active) setLoading(false);
    }, 12000);

    async function restore() {
      if (!tokenStore.get()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (active) setUser(unwrapUser(data));
      } catch {
        tokenStore.clear();
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();

    // A failed token refresh signals the session is gone.
    const onExpired = () => {
      if (!active) return;
      setUser(null);
      setLoading(false);
    };
    window.addEventListener('truentry:session-expired', onExpired);

    return () => {
      active = false;
      clearTimeout(bail);
      window.removeEventListener('truentry:session-expired', onExpired);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { tokens } = data.data;
    tokenStore.set(tokens.accessToken, tokens.refreshToken);
    const u = unwrapUser(data);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* ignore */
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    const fresh = unwrapUser(data);
    setUser(fresh);
    return fresh;
  }, []);

  const value = { user, setUser, loading, login, logout, refreshUser, isAuthed: !!user };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
