import React from 'react';
import { JobItem } from '../types';
import {
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
  PauseCircle,
  TrendingUp,
} from 'lucide-react';
import { evaluateJobHealth, getJobTotalDays } from '../utils/jobCalculations';

interface JobRowProps {
  job: JobItem;
  index: number;
  currentDateText: string;
  onEdit?: (job: JobItem) => void;
  onDelete?: (id: number) => void;
  onFinish?: (job: JobItem) => void;
}

export const JobRow: React.FC<JobRowProps> = ({
  job,
  index,
  currentDateText,
  onEdit,
  onDelete,
  onFinish,
}) => {
  const targetPct = Math.min(Math.max(job.progress_target, 0), 100);
  const actualPct = Math.min(Math.max(job.progress_actual, 0), 100);
  const totalDays = getJobTotalDays(job.start, job.finish);
  const hasActions = Boolean(onFinish || onEdit || onDelete);

  const evaluation = evaluateJobHealth(job, currentDateText);
  const isHold = evaluation.workStatus === 'HOLD';
  const isOverdue = evaluation.health === 'OVERDUE';
  const isDelay = evaluation.health === 'DELAY';
  const isOnTrack = evaluation.health === 'ON_TRACK';

  const formattedDelta =
    evaluation.deltaPct > 0
      ? `+${evaluation.deltaPct.toFixed(1)}%`
      : `${evaluation.deltaPct.toFixed(1)}%`;

  return (
    <div
      id={`job-row-${job.id}`}
      className={`group relative w-full rounded-xl px-3 py-[clamp(0.42rem,0.75vh,0.68rem)] lg:px-3.5 shadow-[0_1px_3px_rgba(3,47,115,0.06)] border select-none transition-colors duration-150 grid items-center gap-3 ${
        isHold
          ? 'bg-[#FFFDF7] hover:bg-[#FFF9EB] border-amber-200/90 hover:border-amber-300'
          : isOverdue
          ? 'bg-white hover:bg-rose-50/30 border-rose-200/90 hover:border-rose-300'
          : 'bg-white hover:bg-[#FAFBFD] border-slate-200/90 hover:border-[#032F73]/30'
      }`}
      style={{
        gridTemplateColumns: hasActions
          ? 'minmax(190px, 2.05fr) auto auto 1.55fr auto'
          : 'minmax(190px, 2.05fr) auto auto 1.55fr',
      }}
    >
      {/* Kolom 1: Nomor Urut & Deskripsi Pekerjaan + Status Kerja (I/P | HOLD) + On Track / Delay */}
      <div className="min-w-0 flex items-center gap-3">
        <div
          className={`flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-lg text-white flex items-center justify-center font-bold text-xs lg:text-[13px] font-mono-data tabular-nums ${
            isHold ? 'bg-amber-600' : isOverdue ? 'bg-rose-600' : 'bg-[#032F73]'
          }`}
        >
          {index + 1}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <h3
            className="text-slate-900 font-bold min-w-0 leading-snug break-words"
            title={job.deskripsi}
            style={{
              fontSize: 'clamp(0.84rem, 1.05vw, 1.02rem)',
            }}
          >
            {job.deskripsi}
          </h3>

          {/* Baris Metadata: Status Kerja (I/P atau HOLD) · Penanda Otomatis On Track / Delay · Durasi */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[clamp(0.66rem,0.74vw,0.76rem)] font-medium tabular-nums">
            {/* Status Kerja: I/P atau HOLD */}
            <span
              className={`font-bold tracking-wide uppercase ${
                isHold ? 'text-amber-700' : 'text-[#032F73]'
              }`}
              title={isHold ? 'Status Pekerjaan: HOLD (Ditunda)' : 'Status Pekerjaan: I/P (In Progress)'}
            >
              {evaluation.workStatus}
            </span>

            <span aria-hidden="true" className="text-slate-300">&middot;</span>

            {/* Penanda Otomatis: On Track vs Delay vs Terlambat vs Hold */}
            {isHold && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700 whitespace-nowrap">
                <PauseCircle className="w-3 h-3 flex-shrink-0" />
                <span>Ditunda</span>
              </span>
            )}

            {isOverdue && (
              <span
                className="inline-flex items-center gap-1 font-bold text-rose-600 whitespace-nowrap"
                title={`Melewati tanggal finish (${Math.abs(evaluation.daysRemaining)} hari lewat deadline)`}
              >
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>
                  Terlambat{' '}
                  <span className="font-mono-data">
                    ({Math.abs(evaluation.daysRemaining)}h &middot; {formattedDelta})
                  </span>
                </span>
              </span>
            )}

            {isDelay && (
              <span
                className="inline-flex items-center gap-1 font-bold text-rose-600 whitespace-nowrap"
                title={`Progress Actual tertinggal ${Math.abs(evaluation.deltaPct).toFixed(1)}% dari Target Schedule`}
              >
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>
                  Delay <span className="font-mono-data">({formattedDelta})</span>
                </span>
              </span>
            )}

            {isOnTrack && (
              <span
                className="inline-flex items-center gap-1 font-bold text-emerald-700 whitespace-nowrap"
                title="Progress Actual sesuai atau melampaui Target Schedule"
              >
                <TrendingUp className="w-3 h-3 flex-shrink-0" />
                <span>
                  On Track
                  {evaluation.deltaPct > 0 && (
                    <span className="font-mono-data ml-0.5">({formattedDelta})</span>
                  )}
                </span>
              </span>
            )}

            <span aria-hidden="true" className="text-slate-300 hidden sm:inline">&middot;</span>

            <span className="hidden sm:inline-flex items-center gap-1 text-slate-500 whitespace-nowrap">
              <Clock className="w-3 h-3 text-[#EA7A2D] flex-shrink-0" />
              <span>{totalDays} Hari</span>
            </span>
          </div>
        </div>
      </div>

      {/* Kolom 2: Area/Lokasi & PIC */}
      <div className="w-28 md:w-32 lg:w-36 flex-shrink-0 pl-3 border-l border-slate-200/80 flex flex-col items-start justify-center gap-0.5 overflow-hidden">
        <span
          className="block text-[#032F73] font-extrabold text-[clamp(0.72rem,0.84vw,0.88rem)] tracking-wide uppercase truncate w-full"
          title={`Area: ${job.area}`}
        >
          {job.area}
        </span>

        <div
          className="w-full flex items-center gap-1 text-slate-500 overflow-hidden"
          title={`PIC: ${job.pic || '-'}`}
        >
          <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="text-[clamp(0.64rem,0.72vw,0.76rem)] font-medium truncate">
            {job.pic || '-'}
          </span>
        </div>
      </div>

      {/* Kolom 3: Jadwal Start, Finish & Target Hari */}
      <div className="w-40 md:w-44 lg:w-52 xl:w-56 flex-shrink-0 pl-3 border-l border-slate-200/80 flex flex-col justify-center gap-0.5 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[clamp(0.62rem,0.7vw,0.72rem)] font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0">
            Start
          </span>
          <span className="text-slate-800 font-semibold text-[clamp(0.68rem,0.78vw,0.84rem)] tabular-nums whitespace-nowrap">
            {job.start}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[clamp(0.62rem,0.7vw,0.72rem)] font-semibold uppercase tracking-wider flex-shrink-0 ${
              isOverdue ? 'text-rose-600' : 'text-[#EA7A2D]'
            }`}
          >
            Finish
          </span>
          <span
            className={`font-bold text-[clamp(0.68rem,0.78vw,0.84rem)] tabular-nums whitespace-nowrap ${
              isOverdue ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {job.finish}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5 mt-0.5 border-t border-slate-100">
          <span className="text-[clamp(0.6rem,0.68vw,0.7rem)] font-semibold text-[#032F73] uppercase tracking-wider flex-shrink-0">
            Target
          </span>
          <span className="text-[#032F73] font-bold text-[clamp(0.68rem,0.78vw,0.84rem)] tabular-nums whitespace-nowrap">
            {totalDays} Hari
          </span>
        </div>
      </div>

      {/* Kolom 4: Grafik Bar SCHEDULE (#EA7A2D) & ACTUAL (#1054C1) */}
      <div className="min-w-0 w-full pl-3 border-l border-slate-200/80 flex flex-col justify-center gap-1.5 overflow-hidden">
        {/* Baris 1: Schedule Target (#EA7A2D) */}
        <div className="flex items-center gap-2">
          <span className="w-14 lg:w-[62px] text-right text-[clamp(0.62rem,0.72vw,0.76rem)] font-bold text-[#D96B1F] flex-shrink-0">
            Schedule
          </span>
          <div className="flex-1 h-5 lg:h-[22px] bg-slate-100 rounded-md overflow-hidden relative ring-1 ring-inset ring-slate-200/90 min-w-0">
            <div
              className={`h-full transition-all duration-500 rounded-[5px] ${
                isHold ? 'bg-[#EA7A2D]/60' : 'bg-[#EA7A2D]'
              }`}
              style={{ width: `${targetPct}%` }}
            />
            <div
              className={`absolute inset-0 flex items-center justify-center text-[clamp(0.64rem,0.74vw,0.78rem)] font-bold font-mono-data tabular-nums ${
                targetPct > 55 ? 'text-white' : 'text-slate-800'
              }`}
            >
              {job.progress_target.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Baris 2: Actual Progress (#1054C1) */}
        <div className="flex items-center gap-2">
          <span className="w-14 lg:w-[62px] text-right text-[clamp(0.62rem,0.72vw,0.76rem)] font-bold text-[#1054C1] flex-shrink-0">
            Actual
          </span>
          <div className="flex-1 h-5 lg:h-[22px] bg-slate-100 rounded-md overflow-hidden relative ring-1 ring-inset ring-slate-200/90 min-w-0">
            <div
              className={`h-full transition-all duration-500 rounded-[5px] ${
                isHold ? 'bg-slate-400' : 'bg-[#1054C1]'
              }`}
              style={{ width: `${actualPct}%` }}
            />
            <div
              className={`absolute inset-0 flex items-center justify-center text-[clamp(0.64rem,0.74vw,0.78rem)] font-bold font-mono-data tabular-nums ${
                actualPct > 52 ? 'text-white' : 'text-slate-800'
              }`}
            >
              {job.progress_actual.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Kolom 5: Tombol Aksi (Khusus Mode Admin) */}
      {hasActions && (
        <div className="pl-3 border-l border-slate-200/80 flex flex-col items-center justify-center gap-1.5 flex-shrink-0">
          {onFinish && (
            <button
              onClick={() => onFinish(job)}
              title="Finish Pekerjaan (Selesai & Arsipkan)"
              className="w-full flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[clamp(0.62rem,0.7vw,0.74rem)] transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-white flex-shrink-0" />
              <span>Finish</span>
            </button>
          )}

          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1 w-full justify-center">
              {onEdit && (
                <button
                  onClick={() => onEdit(job)}
                  title="Edit Pekerjaan"
                  className="flex-1 flex items-center justify-center p-1.5 rounded-md bg-[#032F73]/8 hover:bg-[#032F73] text-[#032F73] hover:text-white transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(job.id)}
                  title="Hapus Pekerjaan"
                  className="flex-1 flex items-center justify-center p-1.5 rounded-md bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
