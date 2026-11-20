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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden">
        {/* Header */}
        <div className="bg-[#032F73] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl text-rose-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">
                Konfirmasi Reset Data
              </h3>
              <p className="text-xs text-blue-200/90 font-normal">
                Kosongkan daftar pekerjaan aktif di dashboard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3.5 text-slate-700 text-xs leading-relaxed">
          <p className="text-sm font-medium text-slate-800">
            Apakah Anda yakin ingin mengosongkan seluruh daftar pekerjaan aktif di dashboard?
          </p>

          <div className="bg-[#F4F7FB] border border-[#032F73]/15 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-bold text-[#032F73]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Data Tidak Akan Terhapus Permanen</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sistem otomatis menyimpan <strong className="text-slate-900">{currentJobsCount} pekerjaan</strong> saat ini ke memori cadangan agar tetap bisa dipulihkan kembali.
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Catatan: Untuk menyegarkan kalkulasi atau tampilan layar, gunakan tombol <strong className="text-slate-700">Refresh</strong> di header.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-[#F8FAFC] border-t border-slate-200/80 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmReset();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ya, Kosongkan Daftar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
