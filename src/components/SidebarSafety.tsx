import React, { useState } from 'react';
import { K3SafetyIcons } from './K3SafetyIcons';
import { Calendar, Edit2, Check, Camera, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { formatToISO, formatToIndonesian } from '../utils/jobCalculations';

interface SidebarSafetyProps {
  activeJobsCount: number;
  completedJobsCount?: number;
  totalJobsCount: number;
  onTrackCount?: number;
  delayCount?: number;
  holdCount?: number;
  finishedThisMonthCount?: number;
  currentDateText: string;
  isAutoDate?: boolean;
  onUpdateDateText?: (date: string, isManual?: boolean) => void;
  onResetToAutoDate?: () => void;
  customK3PosterUrl?: string | null;
  useCustomK3Image?: boolean;
  onOpenUploadModal?: (tab?: 'company' | 'k3' | 'welding') => void;
  isReadOnly?: boolean;
}

export const SidebarSafety: React.FC<SidebarSafetyProps> = ({
  activeJobsCount,
  onTrackCount = 0,
  delayCount = 0,
  holdCount = 0,
  finishedThisMonthCount = 0,
  currentDateText,
  isAutoDate = true,
  onUpdateDateText,
  onResetToAutoDate,
  customK3PosterUrl,
  useCustomK3Image = false,
  onOpenUploadModal,
  isReadOnly = false,
}) => {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempIsoDate, setTempIsoDate] = useState(() => formatToISO(currentDateText));

  const handleOpenEdit = () => {
    if (isReadOnly) return;
    setTempIsoDate(formatToISO(currentDateText));
    setIsEditingDate(true);
  };

  const handleDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateDateText && tempIsoDate) {
      onUpdateDateText(formatToIndonesian(tempIsoDate), true);
    }
    setIsEditingDate(false);
  };

  const handleSetToday = () => {
    if (onResetToAutoDate) {
      onResetToAutoDate();
    } else if (onUpdateDateText) {
      const today = new Date();
      onUpdateDateText(formatToIndonesian(today), false);
    }
    setIsEditingDate(false);
  };

  return (
    <aside
      id="dashboard-sidebar-safety"
      className="w-[228px] min-w-[228px] max-w-[228px] flex-shrink-0 flex flex-col gap-2.5 p-2.5 pr-1.5 select-none h-full overflow-hidden bg-transparent"
    >
      {/* KOTAK 1 (TANGGAL): Corporate Orange #EA7A2D */}
      <div
        id="card-sidebar-tanggal"
        className="w-full rounded-xl bg-gradient-to-br from-[#EA7A2D] to-[#DC6A1D] shadow-[0_4px_14px_-4px_rgba(234,122,45,0.45)] ring-1 ring-inset ring-white/15 px-3 py-2.5 flex flex-col items-center justify-center text-center text-white relative group flex-shrink-0"
      >
        <div className="w-full flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-white/85">
            <Calendar className="w-3.5 h-3.5 text-white/90" />
            <span>Hari Ini</span>
          </div>

          <span
            className="text-[10px] font-semibold tracking-wide text-white/90"
            title={
              isAutoDate
                ? 'Otomatis mengikuti tanggal real-time sistem komputer'
                : 'Mode simulasi manual aktif'
            }
          >
            {isAutoDate ? 'Otomatis' : 'Simulasi'}
          </span>
        </div>

        {isEditingDate ? (
          <form onSubmit={handleDateSubmit} className="w-full flex flex-col gap-1.5 mt-0.5">
            <div className="text-[11px] text-white/90 font-medium text-center">
              Pilih Tanggal Simulasi
            </div>
            <input
              type="date"
              value={tempIsoDate}
              onChange={(e) => setTempIsoDate(e.target.value)}
              className="w-full text-center bg-white text-slate-900 font-semibold px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#032F73]/30 font-mono-data tabular-nums"
              autoFocus
            />
            <div className="flex flex-wrap gap-1 justify-center mt-0.5">
              <button
                type="submit"
                className="bg-[#032F73] hover:bg-[#022154] text-white text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors inline-flex items-center gap-1"
                title="Terapkan tanggal simulasi"
              >
                <Check className="w-3 h-3" /> Terapkan
              </button>
              <button
                type="button"
                onClick={handleSetToday}
                className="bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold px-2 py-1 rounded-md transition-colors"
                title="Gunakan tanggal sistem hari ini secara otomatis"
              >
                Otomatis
              </button>
              <button
                type="button"
                onClick={() => setIsEditingDate(false)}
                className="bg-black/15 hover:bg-black/25 text-white text-[11px] font-medium px-2 py-1 rounded-md transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div
              onClick={isReadOnly ? undefined : handleOpenEdit}
              title={isReadOnly ? undefined : 'Klik untuk ubah atau simulasi tanggal referensi'}
              className={`${
                isReadOnly ? 'cursor-default' : 'cursor-pointer'
              } group flex items-center justify-center gap-1.5 w-full py-0.5`}
            >
              <span
                className={`text-[17px] lg:text-[18px] font-extrabold tracking-tight text-white tabular-nums leading-snug ${
                  isReadOnly ? '' : 'group-hover:text-orange-50'
                } transition-colors`}
              >
                {currentDateText}
              </span>
              {!isReadOnly && (
                <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-white/90 transition-opacity flex-shrink-0" />
              )}
            </div>

            {!isReadOnly && !isAutoDate && onResetToAutoDate && (
              <button
                type="button"
                onClick={onResetToAutoDate}
                title="Kembalikan ke tanggal sistem otomatis"
                className="mt-1.5 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-[10.5px] font-semibold px-2.5 py-0.5 rounded-md transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset Real-time</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* KOTAK 2 (JOB AKTIF + RINGKASAN MINI): Corporate Navy #032F73 header + crisp white body */}
      <div
        id="card-sidebar-job-aktif"
        className="w-full rounded-xl overflow-hidden shadow-[0_2px_10px_-3px_rgba(3,47,115,0.12)] ring-1 ring-slate-200/90 flex flex-col bg-white flex-shrink-0"
      >
        <div className="w-full bg-[#032F73] py-1.5 px-3 text-center">
          <h2 className="text-white font-bold text-xs tracking-[0.12em] uppercase">
            Job Aktif
          </h2>
        </div>

        <div className="w-full bg-white py-2 flex items-center justify-center">
          <span className="text-5xl lg:text-[52px] text-[#032F73] font-oswald font-bold tabular-nums leading-none">
            {activeJobsCount}
          </span>
        </div>

        {/* Ringkasan Mini: On Track / Delay / Selesai Bulan Ini */}
        <div
          id="sidebar-mini-summary"
          className="grid grid-cols-3 border-t border-slate-100 bg-[#F8FAFC] divide-x divide-slate-200/75 text-center"
        >
          <div className="py-1.5 px-1 flex flex-col items-center" title="Pekerjaan I/P sesuai atau melampaui target">
            <span className="text-sm font-bold text-emerald-700 font-mono-data tabular-nums leading-tight">
              {onTrackCount}
            </span>
            <span className="text-[9.5px] font-semibold text-slate-500 leading-tight mt-0.5 whitespace-nowrap">
              On Track
            </span>
          </div>

          <div className="py-1.5 px-1 flex flex-col items-center" title="Pekerjaan I/P tertinggal atau melewati deadline">
            <span
              className={`text-sm font-bold font-mono-data tabular-nums leading-tight ${
                delayCount > 0 ? 'text-rose-600' : 'text-slate-400'
              }`}
            >
              {delayCount}
            </span>
            <span className="text-[9.5px] font-semibold text-slate-500 leading-tight mt-0.5 whitespace-nowrap">
              Delay
            </span>
          </div>

          <div className="py-1.5 px-1 flex flex-col items-center" title="Pekerjaan selesai (Finish) bulan ini">
            <span className="text-sm font-bold text-[#032F73] font-mono-data tabular-nums leading-tight">
              {finishedThisMonthCount}
            </span>
            <span className="text-[9.5px] font-semibold text-slate-500 leading-tight mt-0.5 whitespace-nowrap">
              Selesai Bln
            </span>
          </div>
        </div>

        {holdCount > 0 && (
          <div className="border-t border-amber-100 bg-amber-50/70 px-3 py-1 flex items-center justify-between text-[10.5px]">
            <span className="font-semibold text-amber-800">Status HOLD</span>
            <span className="font-bold font-mono-data text-amber-800 tabular-nums">
              {holdCount} Job
            </span>
          </div>
        )}
      </div>

      {/* PANEL GAMBAR K3 / SAFETY (Corporate Navy #032F73) */}
      <div
        id="panel-k3-safety-vertical"
        className="flex-1 min-h-0 w-full rounded-xl bg-[#032F73] ring-1 ring-inset ring-white/10 p-1.5 shadow-[0_4px_14px_-4px_rgba(3,47,115,0.3)] flex flex-col justify-center items-center overflow-hidden relative group"
      >
        {!isReadOnly && onOpenUploadModal && (
          <button
            onClick={() => onOpenUploadModal('k3')}
            title="Upload / Ganti Gambar K3"
            className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/65 hover:bg-[#EA7A2D] text-white ring-1 ring-white/25 backdrop-blur-xs opacity-85 group-hover:opacity-100 transition-all"
          >
            <Camera className="w-3.5 h-3.5 text-orange-300 group-hover:text-white" />
            <span className="text-[10.5px] font-semibold">Ganti</span>
          </button>
        )}

        {customK3PosterUrl && useCustomK3Image ? (
          <div
            onClick={!isReadOnly && onOpenUploadModal ? () => onOpenUploadModal('k3') : undefined}
            className={`w-full h-full flex-1 flex items-center justify-center p-0.5 ${
              isReadOnly ? 'cursor-default' : 'cursor-pointer'
            } relative overflow-hidden group/img`}
            title={isReadOnly ? undefined : 'Klik untuk ganti gambar K3'}
          >
            <img
              src={customK3PosterUrl}
              alt="Poster K3 Welding Shop"
              referrerPolicy="no-referrer"
              className={`w-full h-full object-contain rounded-lg ${
                isReadOnly ? '' : 'transition-transform duration-200 group-hover/img:scale-[1.015]'
              }`}
            />
            {!isReadOnly && (
              <div className="absolute inset-0 bg-[#032F73]/75 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white text-xs font-semibold gap-1.5 rounded-lg transition-opacity pointer-events-none">
                <ImageIcon className="w-6 h-6 text-[#EA7A2D]" />
                <span>Ganti Poster K3</span>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={!isReadOnly && onOpenUploadModal ? () => onOpenUploadModal('k3') : undefined}
            className={`w-full h-full flex-1 flex flex-col justify-center items-center ${
              isReadOnly ? 'cursor-default' : 'cursor-pointer'
            } relative group/img p-1`}
            title={isReadOnly ? undefined : 'Klik untuk upload / ganti gambar K3'}
          >
            <K3SafetyIcons />
            {!isReadOnly && (
              <div className="absolute inset-0 bg-[#032F73]/75 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white text-xs font-semibold gap-1.5 rounded-lg transition-opacity pointer-events-none">
                <ImageIcon className="w-6 h-6 text-[#EA7A2D]" />
                <span>Unggah Poster K3 Asli</span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
