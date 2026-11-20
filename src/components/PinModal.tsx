import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Delete,
  Eye,
  EyeOff,
} from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentPin: string;
  actionDescription?: string;
  onChangePin?: (newPin: string) => void;
  onSessionAuthToggle?: (remember: boolean) => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentPin = '1234',
  actionDescription = 'Otorisasi Diperlukan',
  onChangePin,
  onSessionAuthToggle,
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShake, setIsShake] = useState<boolean>(false);
  const [showPinText, setShowPinText] = useState<boolean>(false);

  // Tab mode: 'verify' untuk verifikasi aksi, 'change' untuk mengganti PIN
  const [mode, setMode] = useState<'verify' | 'change'>('verify');
  const [oldPinChange, setOldPinChange] = useState<string>('');
  const [newPinChange, setNewPinChange] = useState<string>('');
  const [confirmPinChange, setConfirmPinChange] = useState<string>('');
  const [changeSuccessMsg, setChangeSuccessMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMsg(null);
      setMode('verify');
      setOldPinChange('');
      setNewPinChange('');
      setConfirmPinChange('');
      setChangeSuccessMsg(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pinInput.length < 8) {
      const next = pinInput + num;
      setPinInput(next);
      setErrorMsg(null);
      if (next.length === currentPin.length && next === currentPin) {
        // Auto submit if length matches and is correct
        setTimeout(() => {
          if (onSessionAuthToggle) {
            onSessionAuthToggle(true);
          }
          onSuccess();
        }, 150);
      }
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setPinInput('');
    setErrorMsg(null);
  };

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput.trim()) {
      setErrorMsg('Masukkan PIN keamanan terlebih dahulu');
      return;
    }

    if (pinInput === currentPin) {
      if (onSessionAuthToggle) {
        onSessionAuthToggle(true);
      }
      onSuccess();
    } else {
      setIsShake(true);
      setErrorMsg('PIN yang Anda masukkan salah. Default: 1234');
      setPinInput('');
      setTimeout(() => setIsShake(false), 500);
      inputRef.current?.focus();
    }
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (oldPinChange !== currentPin) {
      setErrorMsg('PIN Lama tidak sesuai.');
      return;
    }

    if (newPinChange.trim().length < 4) {
      setErrorMsg('PIN Baru minimal 4 karakter / angka.');
      return;
    }

    if (newPinChange !== confirmPinChange) {
      setErrorMsg('Konfirmasi PIN Baru tidak cocok.');
      return;
    }

    if (onChangePin) {
      onChangePin(newPinChange.trim());
      setChangeSuccessMsg('PIN berhasil diperbarui!');
      setTimeout(() => {
        setMode('verify');
        setChangeSuccessMsg(null);
        setOldPinChange('');
        setNewPinChange('');
        setConfirmPinChange('');
      }, 1200);
    }
  };

  return (
    <div
      id="pin-security-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="pin-security-modal-card"
        className={`w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col ${
          isShake ? 'animate-bounce' : ''
        }`}
      >
        {/* Header Modal */}
        <div className="bg-[#032F73] text-white px-5 py-4 flex items-center justify-between border-b-2 border-blue-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide font-inter">
                {mode === 'verify' ? 'Verifikasi PIN Keamanan' : 'Ganti PIN Keamanan'}
              </h2>
              <p className="text-xs text-blue-200 font-medium truncate max-w-[220px] sm:max-w-[280px]">
                {mode === 'verify' ? actionDescription : 'Atur PIN proteksi baru'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Verifikasi vs Ganti PIN */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('verify');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              mode === 'verify'
                ? 'border-[#032F73] text-[#032F73] bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Verifikasi Aksi</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('change');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              mode === 'change'
                ? 'border-[#032F73] text-[#032F73] bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Ganti PIN</span>
          </button>
        </div>

        {/* Mode 1: Verifikasi PIN */}
        {mode === 'verify' && (
          <form onSubmit={handleVerify} className="p-5 flex flex-col items-center">
            {/* Hidden / Native Input for direct keyboard typing */}
            <div className="w-full relative mb-3">
              <input
                ref={inputRef}
                id="input-pin-code"
                type={showPinText ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/[^0-9]/g, ''));
                  setErrorMsg(null);
                }}
                placeholder="Masukkan PIN (4 Digit)"
                className="w-full text-center text-2xl font-black tracking-widest py-3 px-4 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-[#032F73] focus:bg-white transition-all text-[#032F73]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPinText(!showPinText)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showPinText ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="w-full mb-3 p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5 text-rose-700 text-xs font-bold animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* On-Screen Numeric Keypad */}
            <div className="w-full grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(String(num))}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-blue-100 active:bg-blue-200 text-[#032F73] font-black text-lg shadow-2xs border border-slate-200 transition-all select-none flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 font-black text-xs uppercase tracking-wider border border-slate-200 transition-all select-none flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="py-2.5 rounded-xl bg-slate-100 hover:bg-blue-100 active:bg-blue-200 text-[#032F73] font-black text-lg shadow-2xs border border-slate-200 transition-all select-none flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="py-2.5 rounded-xl bg-slate-100 hover:bg-rose-100 active:bg-rose-200 text-rose-600 font-black border border-slate-200 transition-all select-none flex items-center justify-center"
                title="Hapus Digit Terakhir"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#032F73] hover:bg-blue-900 text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Unlock className="w-4 h-4 text-amber-400" />
                <span>Buka Kunci</span>
              </button>
            </div>
          </form>
        )}

        {/* Mode 2: Ganti PIN */}
        {mode === 'change' && (
          <form onSubmit={handleChangePinSubmit} className="p-5 flex flex-col gap-3">
            {changeSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{changeSuccessMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5 text-rose-700 text-xs font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                PIN Saat Ini (Lama)
              </label>
              <input
                type="password"
                maxLength={8}
                value={oldPinChange}
                onChange={(e) => setOldPinChange(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Masukkan PIN lama (default: 1234)"
                className="w-full text-sm font-bold py-2 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#032F73]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                PIN Baru (Minimal 4 Angka)
              </label>
              <input
                type="password"
                maxLength={8}
                value={newPinChange}
                onChange={(e) => setNewPinChange(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Contoh: 5678"
                className="w-full text-sm font-bold py-2 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#032F73]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Konfirmasi PIN Baru
              </label>
              <input
                type="password"
                maxLength={8}
                value={confirmPinChange}
                onChange={(e) => setConfirmPinChange(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ulangi PIN baru"
                className="w-full text-sm font-bold py-2 px-3 border border-slate-300 rounded-lg focus:outline-none focus:border-[#032F73]"
                required
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('verify')}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm"
              >
                Kembali
              </button>
              <button
                type="submit"
                className="flex-1 py-2 px-4 rounded-xl bg-[#EA7A2D] hover:bg-amber-600 text-white font-black text-sm shadow-sm"
              >
                Simpan PIN Baru
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
