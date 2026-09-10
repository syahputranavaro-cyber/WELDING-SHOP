import React from 'react';
import { JobItem } from '../types';
import { Edit, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { getJobTotalDays } from '../utils/jobCalculations';

interface JobRowProps {
  job: JobItem;
  index: number;
  onEdit?: (job: JobItem) => void;
  onDelete?: (id: number) => void;
  onFinish?: (job: JobItem) => void;
}

export const JobRow: React.FC<JobRowProps> = ({ job, index, onEdit, onDelete, onFinish }) => {
  const targetPct = Math.min(Math.max(job.progress_target, 0), 100);
  const actualPct = Math.min(Math.max(job.progress_actual, 0), 100);
  const totalDays = getJobTotalDays(job.start, job.finish);

  return (
    <div
      id={`job-row-${job.id}`}
      className="group relative w-full bg-[#A4C8EB] rounded-xl p-3 lg:p-3.5 shadow-sm border-2 border-white flex flex-col md:flex-row items-center gap-3 lg:gap-4 select-none transition-all duration-200"
    >
      {/* 1. Nama Pekerjaan (Teks Bold Hitam) & Target Hari Badge */}
      <div className="flex-1 min-w-0 flex items-center gap-3 w-full md:w-auto">
        {/* Nomor Urut */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#032F73] text-white flex items-center justify-center font-black text-sm shadow-sm">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-[#000000] font-black text-base lg:text-lg xl:text-xl leading-snug font-inter"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.015em',
              }}
            >
              {job.deskripsi}
            </h3>
            {/* Target Hari Badge */}
            <span
              className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-950 px-2 py-0.5 rounded text-xs font-black shadow-2xs font-inter tabular-nums"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.015em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Clock className="w-3 h-3 text-amber-700" />
              <span>Target: {totalDays} Hari</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Area (Teks Bold Hitam) */}
      <div className="w-full md:w-32 lg:w-40 flex-shrink-0 flex items-center md:justify-center">
        <div className="w-full bg-white/85 border border-white rounded-lg py-2 px-3 text-center shadow-xs">
          <span
            className="text-[#000000] font-black text-xs lg:text-sm xl:text-base tracking-wider uppercase font-inter"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.015em',
            }}
          >
            {job.area}
          </span>
        </div>
      </div>

      {/* 3. Sub-Tabel Tanggal & Target Hari (Diperbesar untuk TV Monitor) */}
      <div className="w-full md:w-56 lg:w-64 xl:w-72 flex-shrink-0 flex flex-col gap-1.5 bg-white/90 border border-white rounded-lg p-2 lg:p-2.5 shadow-sm font-inter">
        {/* Baris 1: START */}
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs lg:text-sm font-black text-slate-800 uppercase tracking-wider bg-slate-200 px-2.5 py-0.5 rounded shadow-xs">
            START
          </span>
          <span
            className="text-[#000000] font-black tracking-tight text-xs lg:text-sm xl:text-base font-inter tabular-nums"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.015em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {job.start}
          </span>
        </div>

        {/* Baris 2: FINISH */}
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs lg:text-sm font-black text-[#EA7A2D] uppercase tracking-wider bg-orange-100 border border-orange-200 px-2.5 py-0.5 rounded shadow-xs">
            FINISH
          </span>
          <span
            className="text-[#000000] font-black tracking-tight text-xs lg:text-sm xl:text-base font-inter tabular-nums"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.015em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {job.finish}
          </span>
        </div>

        {/* Baris 3: TARGET HARI */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 border-t border-slate-200/80">
          <span className="text-[11px] lg:text-xs font-black text-[#032F73] uppercase tracking-wider bg-blue-100 border border-blue-200 px-2 py-0.5 rounded shadow-xs">
            TARGET HARI
          </span>
          <span
            className="text-[#032F73] font-black tracking-tight text-xs lg:text-sm xl:text-base font-inter tabular-nums"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.015em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {totalDays} Hari
          </span>
        </div>
      </div>

      {/* 4. Sub-Tabel Schedule (Stacked 2 Baris: Schedule & Actual) */}
      <div className="w-full md:w-72 lg:w-88 xl:w-[420px] flex-shrink-0 flex flex-col gap-2 bg-white/95 border border-white rounded-lg p-2.5 lg:p-3 shadow-sm font-inter">
        {/* Baris 1: Schedule Target (Label #EB833C + Bar #EA7A2D) */}
        <div className="flex items-center gap-2.5">
          <span
            className="w-16 lg:w-20 text-right text-xs lg:text-sm font-black text-[#EB833C] uppercase tracking-wider flex-shrink-0 font-inter"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.015em',
            }}
          >
            Schedule
          </span>
          <div className="flex-1 h-6 lg:h-7 bg-slate-200/90 rounded overflow-hidden relative border border-slate-300 shadow-inner">
            <div
              className="h-full bg-[#EA7A2D] transition-all duration-500 rounded-xs"
              style={{ width: `${targetPct}%` }}
            />
            {/* Teks persentase di dalam/di atas bar berukuran besar, tebal, & tabular-nums */}
            <div
              className={`absolute inset-0 flex items-center justify-center text-xs lg:text-sm font-black font-inter tabular-nums tracking-normal ${
                targetPct > 55 ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-slate-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]'
              }`}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.015em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {job.progress_target.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Baris 2: Actual (Label #1054C1 + Bar #1054C1) */}
        <div className="flex items-center gap-2.5">
          <span
            className="w-16 lg:w-20 text-right text-xs lg:text-sm font-black text-[#1054C1] uppercase tracking-wider flex-shrink-0 font-inter"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.015em',
            }}
          >
            Actual
          </span>
          <div className="flex-1 h-6 lg:h-7 bg-slate-200/90 rounded overflow-hidden relative border border-slate-300 shadow-inner">
            <div
              className="h-full bg-[#1054C1] transition-all duration-500 rounded-xs"
              style={{ width: `${actualPct}%` }}
            />
            {/* Teks persentase tabular-nums */}
            <div
              className={`absolute inset-0 flex items-center justify-center text-xs lg:text-sm font-black font-inter tabular-nums tracking-normal ${
                actualPct > 50
                  ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                  : 'text-slate-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]'
              }`}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.015em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {job.progress_actual.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons including Finish, Edit, Delete */}
      <div className="flex md:flex-col items-center justify-center gap-1.5 flex-shrink-0">
        {onFinish && (
          <button
            onClick={() => onFinish(job)}
            title="Finish Pekerjaan (Selesai & Hapus dari Dashboard)"
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all whitespace-nowrap"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>Finish</span>
          </button>
        )}

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                onClick={() => onEdit(job)}
                title="Edit Pekerjaan"
                className="p-1.5 rounded-md bg-[#032F73] hover:bg-blue-900 text-white transition-colors shadow-xs"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(job.id)}
                title="Hapus Pekerjaan"
                className="p-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
