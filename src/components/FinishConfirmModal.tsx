import React from 'react';
import { CheckCircle2, X, Calendar, MapPin, AlertCircle } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-lg text-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-wide">
                Konfirmasi Finish Pekerjaan
              </h3>
              <p className="text-[11px] text-emerald-100">
                Tandai pekerjaan telah rampung dikerjakan
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
            Apakah pekerjaan berikut telah selesai dikerjakan (<span className="text-emerald-700 font-black">FINISH</span>)?
          </p>

          {/* Job Card Preview */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="font-black text-sm text-emerald-950">
              {job.deskripsi}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-emerald-200 font-bold text-slate-700">
                <MapPin className="w-3 h-3 text-emerald-600" />
                Area: {job.area}
              </span>
              <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-emerald-200 font-bold text-slate-700">
                <Calendar className="w-3 h-3 text-emerald-600" />
                Target: {totalDays} Hari
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 font-black">
                Actual: {job.progress_actual}%
              </span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-normal">
              Ketika pekerjaan berstatus <strong>FINISH</strong>, sistem akan secara otomatis <strong>menghapus pekerjaan ini dari tampilan dashboard</strong> agar fokus pada sisa pekerjaan yang sedang berjalan. Data tetap tersimpan di riwayat arsip.
            </p>
          </div>
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
              onConfirmFinish(job);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-colors uppercase tracking-wider"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Ya, Finish & Hapus dari Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
