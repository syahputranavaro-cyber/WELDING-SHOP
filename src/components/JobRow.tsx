import React from 'react';
import { JobItem } from '../types';
import { Edit, Trash2, CheckCircle2, Clock, User } from 'lucide-react';
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
      className="group relative w-full bg-[#A4C8EB] rounded-xl px-2.5 py-[clamp(0.18rem,0.45vh,0.38rem)] lg:px-3 shadow-xs border-2 border-white select-none transition-all duration-200 grid items-center gap-2 lg:gap-2.5"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 2fr) auto auto 1.5fr auto',
        height: 'auto',
      }}
    >
      {/* Kolom 1: Nomor & Deskripsi Pekerjaan (flex: 1, min-width: 0) + Target Hari Badge */}
      <div className="min-w-0 flex items-center gap-2 lg:gap-2.5" style={{ height: 'auto' }}>
        {/* Nomor Urut */}
        <div className="flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-[#032F73] text-white flex items-center justify-center font-black text-xs lg:text-sm shadow-xs font-inter tabular-nums">
          {index + 1}
        </div>

        {/* Kontainer Judul dan Badge (Vertikal flex-col dengan height: auto) */}
        <div
          className="flex-1 min-w-0 flex flex-col justify-center gap-1"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            height: 'auto',
          }}
        >
          <h3
            className="text-[#000000] font-black font-inter min-w-0"
            title={job.deskripsi}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.015em',
              fontSize: 'clamp(0.85rem, 1.1vw, 1.1rem)',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              lineHeight: 1.25,
            }}
          >
            {job.deskripsi}
          </h3>

          {/* Target Hari Badge di baris baru tepat di bawah teks deskripsi pekerjaan */}
          <div className="flex items-center">
            <span
              className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-950 px-1.5 py-0.5 rounded text-[clamp(0.65rem,0.75vw,0.78rem)] font-black shadow-2xs font-inter tabular-nums whitespace-nowrap"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.015em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Clock className="w-3 h-3 text-amber-700 flex-shrink-0" />
              <span>Target: {totalDays} Hari</span>
            </span>
          </div>
        </div>
      </div>

      {/* Kolom 2: Badge Area/Lokasi & PIC (NAMA) (flex-shrink: 0, fixed-width) */}
      <div className="w-28 md:w-32 lg:w-36 flex-shrink-0 flex items-center justify-center overflow-hidden">
        <div className="w-full bg-white/95 border border-white rounded-lg py-1 px-1.5 flex flex-col items-center justify-center gap-0.5 shadow-2xs overflow-hidden">
          {/* AREA / LOKASI PABRIK */}
          <span
            className="block text-[#000000] font-black text-[clamp(0.7rem,0.86vw,0.9rem)] tracking-wider uppercase font-inter truncate overflow-hidden text-ellipsis whitespace-nowrap w-full text-center"
            title={`Area: ${job.area}`}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.015em',
            }}
          >
            {job.area}
          </span>

          {/* PIC (NAMA) DIBAWAH AREA/LOKASI PABRIK */}
          <div
            className="w-full border-t border-slate-200/90 pt-0.5 flex items-center justify-center gap-1 overflow-hidden"
            title={`PIC: ${job.pic || '-'}`}
          >
            <User className="w-2.5 h-2.5 text-[#032F73] flex-shrink-0" />
            <span
              className="text-[#032F73] font-black text-[clamp(0.6rem,0.72vw,0.76rem)] font-inter truncate whitespace-nowrap"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.01em',
              }}
            >
              {job.pic ? `PIC: ${job.pic}` : 'PIC: -'}
            </span>
          </div>
        </div>
      </div>

      {/* Kolom 3: Tabel Tanggal & Target Hari (flex-shrink: 0) */}
      <div className="w-40 md:w-44 lg:w-52 xl:w-56 flex-shrink-0 flex flex-col justify-center gap-0.5 lg:gap-1 bg-white/90 border border-white rounded-lg p-1.5 lg:p-2 shadow-2xs font-inter overflow-hidden">
        {/* Baris 1: START */}
        <div className="flex items-center justify-between gap-1 px-0.5">
          <span className="text-[clamp(0.62rem,0.72vw,0.75rem)] font-black text-slate-800 uppercase tracking-wider bg-slate-200 px-1.5 py-0.2 rounded shadow-2xs flex-shrink-0">
            START
          </span>
          <span
            className="text-[#000000] font-black tracking-tight text-[clamp(0.68rem,0.8vw,0.88rem)] font-inter tabular-nums whitespace-nowrap"
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
        <div className="flex items-center justify-between gap-1 px-0.5">
          <span className="text-[clamp(0.62rem,0.72vw,0.75rem)] font-black text-[#EA7A2D] uppercase tracking-wider bg-orange-100 border border-orange-200 px-1.5 py-0.2 rounded shadow-2xs flex-shrink-0">
            FINISH
          </span>
          <span
            className="text-[#000000] font-black tracking-tight text-[clamp(0.68rem,0.8vw,0.88rem)] font-inter tabular-nums whitespace-nowrap"
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
        <div className="flex items-center justify-between gap-1 px-0.5 pt-0.5 border-t border-slate-200/80">
          <span className="text-[clamp(0.58rem,0.68vw,0.72rem)] font-black text-[#032F73] uppercase tracking-wider bg-blue-100 border border-blue-200 px-1.5 py-0.2 rounded shadow-2xs flex-shrink-0">
            TARGET HARI
          </span>
          <span
            className="text-[#032F73] font-black tracking-tight text-[clamp(0.68rem,0.8vw,0.88rem)] font-inter tabular-nums whitespace-nowrap"
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

      {/* Kolom 4: Grafik Bar SCHEDULE & ACTUAL (min-w-0, 1.5fr in grid) */}
      <div className="min-w-0 w-full flex flex-col justify-center gap-1 lg:gap-1.5 bg-white/95 border border-white rounded-lg p-1.5 lg:p-2 shadow-2xs font-inter overflow-hidden">
        {/* Baris 1: Schedule Target (Label #EB833C + Bar #EA7A2D) */}
        <div className="flex items-center gap-1.5 lg:gap-2">
          <span
            className="w-14 lg:w-16 text-right text-[clamp(0.62rem,0.75vw,0.82rem)] font-black text-[#EB833C] uppercase tracking-wider flex-shrink-0 font-inter"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
            }}
          >
            Schedule
          </span>
          <div className="flex-1 h-5 lg:h-6 bg-slate-200/90 rounded overflow-hidden relative border border-slate-300 shadow-inner min-w-0">
            <div
              className="h-full bg-[#EA7A2D] transition-all duration-500 rounded-xs"
              style={{ width: `${targetPct}%` }}
            />
            {/* Teks persentase */}
            <div
              className={`absolute inset-0 flex items-center justify-center text-[clamp(0.62rem,0.75vw,0.82rem)] font-black font-inter tabular-nums tracking-normal ${
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
        <div className="flex items-center gap-1.5 lg:gap-2">
          <span
            className="w-14 lg:w-16 text-right text-[clamp(0.62rem,0.75vw,0.82rem)] font-black text-[#1054C1] uppercase tracking-wider flex-shrink-0 font-inter"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
            }}
          >
            Actual
          </span>
          <div className="flex-1 h-5 lg:h-6 bg-slate-200/90 rounded overflow-hidden relative border border-slate-300 shadow-inner min-w-0">
            <div
              className="h-full bg-[#1054C1] transition-all duration-500 rounded-xs"
              style={{ width: `${actualPct}%` }}
            />
            {/* Teks persentase tabular-nums */}
            <div
              className={`absolute inset-0 flex items-center justify-center text-[clamp(0.62rem,0.75vw,0.82rem)] font-black font-inter tabular-nums tracking-normal ${
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

      {/* Kolom 5: Tombol FINISH, Edit, Hapus (flex-shrink: 0) */}
      <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0">
        {onFinish && (
          <button
            onClick={() => onFinish(job)}
            title="Finish Pekerjaan (Selesai & Hapus dari Dashboard)"
            className="flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[clamp(0.6rem,0.7vw,0.74rem)] uppercase tracking-wider shadow-xs transition-all whitespace-nowrap"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            <span>Finish</span>
          </button>
        )}

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={() => onEdit(job)}
                title="Edit Pekerjaan"
                className="p-1 rounded-md bg-[#032F73] hover:bg-blue-900 text-white transition-colors shadow-xs"
              >
                <Edit className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(job.id)}
                title="Hapus Pekerjaan"
                className="p-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-xs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
