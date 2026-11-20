import React from 'react';
import { CheckCircle2, X, AlertCircle } from 'lucide-react';
import { JobItem } from '../types';
import { getJobTotalDays } from '../utils/jobCalculations';

interface FinishConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobItem | null;
  onConfirmFinish: (job: JobItem) => void;
}

export const FinishConfirmModal: React.FC<FinishConfirmModalProps> = ({
  isOpen,
  onClose,
  job,
  onConfirmFinish,
}) => {
  if (!isOpen || !job) return null;

  const totalDays = getJobTotalDays(job.start, job.finish);

  return (
    <div
      id="modal-finish-confirm"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden">
        {/* Header */}
        <div className="bg-[#032F73] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">
                Konfirmasi Finish Pekerjaan
              </h3>
              <p className="text-xs text-blue-200/90 font-normal">
                Tandai pekerjaan telah rampung dikerjakan
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
        <div className="p-5 flex flex-col gap-4 text-slate-700 text-xs leading-relaxed">
          <p className="text-sm font-medium text-slate-800">
            Apakah pekerjaan berikut telah selesai dikerjakan (<strong className="text-emerald-700 font-bold">Finish</strong>)?
          </p>

          {/* Job Preview — clean unboxed metadata with typographic separators */}
          <div className="bg-[#F4F7FB] border border-[#032F73]/15 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="font-bold text-sm text-[#032F73]">
              {job.deskripsi}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium tabular-nums">
              <span>{job.area}</span>
              <span aria-hidden="true" className="text-slate-300">&middot;</span>
              <span>Target {totalDays} Hari</span>
              <span aria-hidden="true" className="text-slate-300">&middot;</span>
              <span className="font-mono-data font-bold text-emerald-700">
                Actual {job.progress_actual}%
              </span>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-amber-950">
            <AlertCircle className="w-4 h-4 text-[#EA7A2D] flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-slate-700">
              Pekerjaan berstatus <strong className="text-slate-900">Finish</strong> akan dipindahkan dari dashboard aktif ke <strong className="text-slate-900">Arsip Selesai</strong> agar layar tetap fokus pada pekerjaan yang sedang berjalan.
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
              onConfirmFinish(job);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Ya, Tandai Finish</span>
          </button>
        </div>
      </div>
    </div>
  );
};
