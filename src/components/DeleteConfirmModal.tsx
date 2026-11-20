import React, { useEffect } from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import { JobItem } from '../types';
import { getJobTotalDays, normalizeWorkStatus } from '../utils/jobCalculations';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobItem | null;
  onConfirmDelete: (job: JobItem) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  job,
  onConfirmDelete,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !job) return null;

  const totalDays = getJobTotalDays(job.start, job.finish);
  const workStatus = normalizeWorkStatus(job.status);

  return (
    <div
      id="modal-delete-confirm"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden">
        {/* Header */}
        <div className="bg-[#032F73] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/20 border border-rose-400/30 rounded-xl text-rose-300">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">
                Peringatan Hapus Pekerjaan
              </h3>
              <p className="text-xs text-blue-200/90 font-normal">
                Konfirmasi sebelum menghapus dari dashboard aktif
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 text-slate-700 text-xs leading-relaxed">
          <p className="text-sm font-medium text-slate-800">
            Apakah Anda yakin ingin <strong className="text-rose-600 font-bold">menghapus</strong> pekerjaan berikut dari daftar aktif?
          </p>

          {/* Job Preview */}
          <div className="bg-[#F4F7FB] border border-[#032F73]/15 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="font-bold text-sm text-[#032F73] leading-snug">
              {job.deskripsi}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium tabular-nums">
              <span className="font-bold text-[#032F73]">{workStatus}</span>
              <span aria-hidden="true" className="text-slate-300">&middot;</span>
              <span>{job.area}</span>
              {job.pic && (
                <>
                  <span aria-hidden="true" className="text-slate-300">&middot;</span>
                  <span>PIC: {job.pic}</span>
                </>
              )}
              <span aria-hidden="true" className="text-slate-300">&middot;</span>
              <span>Target {totalDays} Hari</span>
              <span aria-hidden="true" className="text-slate-300">&middot;</span>
              <span className="font-mono-data font-bold text-[#1054C1]">
                Actual {job.progress_actual.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="bg-rose-50/80 border border-rose-200/90 rounded-xl p-3 flex items-start gap-2.5 text-rose-950">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-slate-700">
              Pekerjaan ini akan dihapus dari layar TV dan seluruh perangkat terhubung, lalu dipindahkan ke <strong className="text-slate-900">Arsip Dihapus</strong> (masih dapat dipulihkan dari menu Arsip jika diperlukan).
            </p>
          </div>
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
              onConfirmDelete(job);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Ya, Hapus Pekerjaan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
