import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { setAuthTokenProvider } from '../utils/syncService';

export type UserRole = 'admin' | 'guest';

export interface LocalUser {
  email: string;
  displayName: string;
  role: UserRole;
  loggedInAt: string;
  token?: string;
  expiresAt?: string;
}

interface AuthContextValue {
  user: LocalUser | null;
  isGuest: boolean;
  loading: boolean;
  authError: string | null;
  signInWithLocalAccount: (
    email: string,
    password: string,
    remember?: boolean
  ) => Promise<boolean>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const SESSION_STORAGE_KEY = 'welding_shop_local_session_v1';

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isGuest: false,
  loading: true,
  authError: null,
  signInWithLocalAccount: async () => false,
  signInAsGuest: () => {},
  signOut: async () => {},
  clearAuthError: () => {},
});

function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function readStoredSession(): LocalUser | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem(SESSION_STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;

      if (parsed.role === 'guest') {
        return {
          email: 'tamu@welding.local',
          displayName: 'Tamu (View Only)',
          role: 'guest',
          loggedInAt: parsed.loggedInAt || new Date().toISOString(),
        };
      }

      if (
        parsed.role === 'admin' &&
        typeof parsed.email === 'string' &&
        typeof parsed.token === 'string' &&
        parsed.token.length > 10
      ) {
        if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
          clearStoredSession();
          return null;
        }
        return {
          email: parsed.email,
          displayName: parsed.displayName || 'Admin Welding Shop',
          role: 'admin',
          loggedInAt: parsed.loggedInAt || new Date().toISOString(),
          token: parsed.token,
          expiresAt: parsed.expiresAt,
        };
      }

      // Sesi admin lama tanpa server token: bersihkan agar admin login sekali untuk memperoleh Bearer token
      clearStoredSession();
    } catch {
      // ignore storage errors
    }
  }
  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    setAuthTokenProvider(async () => tokenRef.current);

    const existing = readStoredSession();
    if (existing?.role === 'admin' && existing.token) {
      tokenRef.current = existing.token;
      setUser(existing);
      setLoading(false);

      // Verifikasi token secara silent ke server agar token invalid/expired langsung ditangani
      fetch('/api/auth/verify', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${existing.token}` },
      })
        .then((res) => {
          if (res.status === 401) {
            tokenRef.current = null;
            clearStoredSession();
            setUser(null);
            setAuthError('Sesi Admin telah berakhir. Silakan login kembali.');
          }
        })
        .catch(() => {
          // Abaikan error jaringan sementara
        });
      return;
    }

    tokenRef.current = null;
    setUser(existing);
    setLoading(false);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const signInWithLocalAccount = useCallback(
    async (email: string, password: string, remember: boolean = true): Promise<boolean> => {
      setAuthError(null);

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        setAuthError('Email dan password wajib diisi.');
        return false;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success || !data?.token) {
          setAuthError(data?.message || 'Email atau password salah. Silakan periksa kembali.');
          return false;
        }

        const sessionUser: LocalUser = {
          email: data.user?.email || normalizedEmail,
          displayName: data.user?.displayName || 'Admin Welding Shop',
          role: 'admin',
          loggedInAt: new Date().toISOString(),
          token: data.token,
          expiresAt: data.expiresAt,
        };

        tokenRef.current = data.token;
        clearStoredSession();
        try {
          const targetStorage = remember ? localStorage : sessionStorage;
          targetStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
        } catch {
          // ignore storage quota/private mode errors
        }

        setUser(sessionUser);
        return true;
      } catch {
        setAuthError('Tidak dapat terhubung ke server autentikasi. Periksa koneksi jaringan.');
        return false;
      }
    },
    []
  );

  const signInAsGuest = useCallback(() => {
    setAuthError(null);
    tokenRef.current = null;
    const guestUser: LocalUser = {
      email: 'tamu@welding.local',
      displayName: 'Tamu (View Only)',
      role: 'guest',
      loggedInAt: new Date().toISOString(),
    };

    clearStoredSession();
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(guestUser));
    } catch {
      // ignore storage errors
    }

    setUser(guestUser);
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    tokenRef.current = null;
    clearStoredSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest: user?.role === 'guest',
        loading,
        authError,
        signInWithLocalAccount,
        signInAsGuest,
        signOut,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
