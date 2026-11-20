import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PupukKaltimLogo, WeldingShopLogo } from './BrandLogos';
import { ShieldCheck, LogIn, Loader2, AlertCircle } from 'lucide-react';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, authError, signInWithGoogle } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#F4F6F9] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#032F73] animate-spin" />
          <p className="text-sm font-bold text-slate-600 tracking-wide">
            Memuat Dashboard Welding Shop...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#032F73] via-[#0B3D8E] to-[#061D45] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-blue-200/60 overflow-hidden">
          <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-4">
            <PupukKaltimLogo className="h-10" />
            <WeldingShopLogo className="h-10" />
          </div>

          <div className="p-7 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-[#032F73]" />
            </div>

            <h1 className="text-xl font-black text-[#032F73] tracking-wide uppercase">
              DASHBOARD WELDING SHOP
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 leading-relaxed max-w-xs">
              Masuk dengan akun Google Anda untuk mengakses monitoring aktivitas, arsip pekerjaan, dan sinkronisasi multi-perangkat.
            </p>

            {authError && (
              <div className="w-full mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full mt-6 flex items-center justify-center gap-2.5 py-3 px-5 rounded-xl bg-[#032F73] hover:bg-blue-900 active:scale-[0.99] text-white font-black text-sm shadow-md transition-all"
            >
              <LogIn className="w-4 h-4 text-amber-400" />
              <span>Masuk dengan Google</span>
            </button>

            <p className="text-[11px] text-slate-400 mt-5">
              PT Pupuk Kalimantan Timur &bull; SBU Jasa Pelayanan Pabrik
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
