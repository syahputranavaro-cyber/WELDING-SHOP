import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BrandingImages } from '../types';
import { apiFetchState } from '../utils/syncService';
import {
  LogIn,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

function readCachedBranding(): BrandingImages {
  try {
    const saved = localStorage.getItem('welding_shop_branding_v3');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return {
    companyLogoUrl: null,
    weldingLogoUrl: null,
    k3PosterUrl: null,
    useCustomK3Image: false,
  };
}

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, authError, signInWithLocalAccount, signInAsGuest, clearAuthError } =
    useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [branding, setBranding] = useState<BrandingImages>(() => readCachedBranding());

  // Sinkronkan logo perusahaan & logo welding shop dari cache/server agar selalu sama dengan dashboard
  useEffect(() => {
    if (user) return;
    setBranding(readCachedBranding());

    let cancelled = false;
    apiFetchState().then((res) => {
      if (cancelled || !res?.data?.branding) return;
      setBranding(res.data.branding);
      try {
        localStorage.setItem('welding_shop_branding_v3', JSON.stringify(res.data.branding));
      } catch {
        // ignore
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#EFF3F8] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 text-[#032F73] animate-spin" />
          <p className="text-sm font-semibold text-slate-600">
            Memuat Dashboard Welding Shop...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      await signInWithLocalAccount(email, password, rememberMe);
      setSubmitting(false);
    };

    return (
      <div className="min-h-screen w-full bg-[#022154] bg-[radial-gradient(ellipse_at_top,_rgba(16,84,193,0.38),_transparent_62%)] flex items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-[0_24px_60px_-15px_rgba(2,20,52,0.5)] ring-1 ring-white/15 overflow-hidden">
          {/* Header Brand Bar — Menampilkan Logo Sama Persis dengan Dashboard */}
          <div className="bg-[#F8FAFC] px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
            {/* Logo Kiri: Perusahaan (Custom atau Default) */}
            <div className="flex-1 flex items-center justify-center min-w-0">
              {branding.companyLogoUrl ? (
                <img
                  src={branding.companyLogoUrl}
                  alt="Logo Perusahaan"
                  referrerPolicy="no-referrer"
                  className="max-h-10 max-w-[175px] w-auto object-contain"
                />
              ) : (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <path
                        d="M 50 8 C 24 8 12 24 12 50 C 12 76 28 92 50 94 C 72 92 88 76 88 50 C 88 24 76 8 50 8 Z"
                        fill="#032F73"
                      />
                      <path
                        d="M 50 14 C 28 14 18 28 18 50 C 18 72 32 86 50 88 C 68 86 82 72 82 50 C 82 28 72 14 50 14 Z"
                        fill="none"
                        stroke="#EA7A2D"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M 50 20 C 38 28 32 44 38 60 C 44 70 50 78 50 78 C 50 78 56 70 62 60 C 68 44 62 28 50 20 Z"
                        fill="#10B981"
                      />
                      <path
                        d="M 50 30 C 43 38 42 48 46 56 C 48 60 50 64 50 64 C 50 64 52 60 54 56 C 58 48 57 38 50 30 Z"
                        fill="#EA7A2D"
                      />
                      <circle cx="50" cy="48" r="3.5" fill="#FFFFFF" />
                    </svg>
                  </div>
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="text-[#032F73] text-xs font-extrabold tracking-wide truncate">
                      PUPUK KALTIM
                    </span>
                    <span className="text-[#EA7A2D] text-[9.5px] font-bold uppercase tracking-wider truncate">
                      SBU Jasa Pelayanan Pabrik
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200 flex-shrink-0" />

            {/* Logo Kanan: Welding Shop (Custom atau Default) */}
            <div className="flex-1 flex items-center justify-center min-w-0">
              {branding.weldingLogoUrl ? (
                <img
                  src={branding.weldingLogoUrl}
                  alt="Logo Welding Shop"
                  referrerPolicy="no-referrer"
                  className="max-h-10 max-w-[175px] w-auto object-contain"
                />
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#032F73] flex items-center justify-center p-1.5 flex-shrink-0">
                    <svg viewBox="0 0 48 48" className="w-full h-full">
                      <path
                        d="M6 40 L6 22 L14 26 L14 22 L22 26 L22 18 L32 18 L32 40 Z"
                        fill="#FFFFFF"
                      />
                      <path
                        d="M26 10 L28 14 M30 7 L31 13"
                        stroke="#EA7A2D"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="36" cy="28" r="3" fill="#EA7A2D" />
                      <path
                        d="M36 21 L36 35 M29 28 L43 28 M31 23 L41 33 M31 33 L41 23"
                        stroke="#EA7A2D"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="text-[#EA7A2D] text-xs font-extrabold tracking-wide truncate">
                      WELDING SHOP
                    </span>
                    <span className="text-[#032F73] text-[9.5px] font-bold uppercase tracking-wider truncate">
                      Workshop &amp; Fabrication
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-7">
            <div className="flex flex-col items-center text-center mb-6">
              <h1 className="text-xl font-extrabold text-[#032F73] tracking-tight">
                Dashboard Welding Shop
              </h1>
            </div>

            {authError && (
              <div className="w-full mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (authError) clearAuthError();
                    }}
                    placeholder="Masukan Email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-[#032F73] focus:ring-2 focus:ring-[#032F73]/15 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (authError) clearAuthError();
                    }}
                    placeholder="Masukan Password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-[#032F73] focus:ring-2 focus:ring-[#032F73]/15 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 accent-[#032F73]"
                />
                <span className="text-xs font-medium text-slate-600">
                  Tetap masuk di perangkat ini
                </span>
              </label>

              <button
                id="btn-local-login-submit"
                type="submit"
                disabled={submitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#032F73] hover:bg-[#022154] disabled:opacity-60 text-white font-bold text-sm shadow-[0_6px_16px_-4px_rgba(3,47,115,0.45)] transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#EA7A2D]" />
                ) : (
                  <LogIn className="w-4 h-4 text-[#EA7A2D]" />
                )}
                <span>{submitting ? 'Memverifikasi...' : 'Masuk ke Dashboard'}</span>
              </button>
            </form>

            {/* Divider & Tombol Mode Tamu (View Only) */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] font-medium text-slate-400">
                atau
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              id="btn-guest-view-only"
              type="button"
              onClick={signInAsGuest}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-white hover:bg-slate-50 text-[#032F73] border border-slate-200 hover:border-[#032F73]/35 font-semibold text-sm transition-colors"
            >
              <Eye className="w-4 h-4 text-[#EA7A2D]" />
              <span>Masuk sebagai Tamu (View Only)</span>
            </button>

            <p className="text-[11px] text-slate-400 mt-5 text-center">
              PT Pupuk Kalimantan Timur &middot; SBU Jasa Pelayanan Pabrik
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
