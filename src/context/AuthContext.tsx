import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { setAuthTokenProvider } from '../utils/syncService';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  authError: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  getIdToken: async () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    const currentUser = userRef.current || auth.currentUser;
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken();
    } catch (err) {
      console.error('Failed to retrieve ID token:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    setAuthTokenProvider(getIdToken);
  }, [getIdToken]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      userRef.current = firebaseUser;
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Jendela login ditutup sebelum selesai. Silakan coba lagi.');
      } else {
        setAuthError('Gagal masuk dengan akun Google. Pastikan pop-up browser tidak diblokir.');
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
