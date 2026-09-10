import React from 'react';
import { AlertTriangle, RotateCcw, X, ShieldCheck } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: () => void;
  currentJobsCount: number;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
  currentJobsCount,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="modal-reset-confirm"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-rose-700 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-lg text-yellow-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-wide">
                Konfirmasi Reset Data
              </h3>
              <p className="text-[11px] text-rose-100">
                Kembalikan ke data contoh awal pabrik
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3.5 text-slate-700 text-xs leading-relaxed">
          <p className="text-sm font-semibold text-slate-900">
            Apakah Anda yakin ingin mereset seluruh daftar pekerjaan ke 3 data awal default pabrik?
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-1.5 text-amber-900">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Data Anda Tidak Akan Terhapus Permanen</span>
            </div>
            <p className="text-[11px]">
              Sistem akan secara otomatis menyimpan <strong>{currentJobsCount} pekerjaan</strong> yang Anda miliki saat ini ke memori cadangan (backup). Anda tetap dapat memulihkannya kembali kapan saja menggunakan tombol <strong>"Pulihkan Data"</strong>.
            </p>
          </div>

          <p className="text-[11px] text-slate-500">
            Catatan: Jika Anda hanya ingin menyegarkan kalkulasi atau tampilan layar, gunakan tombol <strong>Refresh (Panah Melingkar)</strong> di header. Tombol Refresh aman dan tidak mengubah data apa pun.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmReset();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-black shadow-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ya, Reset ke Data Awal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
