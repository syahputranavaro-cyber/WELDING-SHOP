import React, { useState } from 'react';
import { K3SafetyIcons } from './K3SafetyIcons';
import { Calendar, Edit2, Check, Camera, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { formatToISO, formatToIndonesian } from '../utils/jobCalculations';

interface SidebarSafetyProps {
  activeJobsCount: number;
  completedJobsCount?: number;
  totalJobsCount: number;
  currentDateText: string;
  onUpdateDateText?: (date: string) => void;
  customK3PosterUrl?: string | null;
  useCustomK3Image?: boolean;
  onOpenUploadModal?: (tab?: 'company' | 'k3' | 'welding') => void;
}

export const SidebarSafety: React.FC<SidebarSafetyProps> = ({
  activeJobsCount,
  currentDateText,
  onUpdateDateText,
  customK3PosterUrl,
  useCustomK3Image = false,
  onOpenUploadModal,
}) => {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempIsoDate, setTempIsoDate] = useState(() => formatToISO(currentDateText));

  const handleOpenEdit = () => {
    setTempIsoDate(formatToISO(currentDateText));
    setIsEditingDate(true);
  };

  const handleDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateDateText && tempIsoDate) {
      onUpdateDateText(formatToIndonesian(tempIsoDate));
    }
    setIsEditingDate(false);
  };

  const handleSetToday = () => {
    const today = new Date();
    const formatted = formatToIndonesian(today);
    if (onUpdateDateText) {
      onUpdateDateText(formatted);
    }
    setIsEditingDate(false);
  };

  return (
    <aside
      id="dashboard-sidebar-safety"
      className="w-56 lg:w-64 flex-shrink-0 flex flex-col gap-2.5 p-2.5 select-none h-full overflow-hidden bg-transparent"
    >
      {/* KOTAK 1 (TANGGAL): Card Orange (#EA7A2D) dengan teks putih bold */}
      <div
        id="card-sidebar-tanggal"
        className="w-full rounded-xl bg-[#EA7A2D] shadow-md border-2 border-orange-400 p-2.5 flex flex-col items-center justify-center text-center text-white relative group"
      >
        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-orange-100 mb-0.5">
          <Calendar className="w-3.5 h-3.5 text-white" />
          <span>HARI INI</span>
        </div>

        {isEditingDate ? (
          <form onSubmit={handleDateSubmit} className="w-full flex flex-col gap-1.5 mt-1">
            <input
              type="date"
              value={tempIsoDate}
              onChange={(e) => setTempIsoDate(e.target.value)}
              className="w-full text-center bg-white text-slate-900 font-bold px-2 py-1 rounded text-xs focus:outline-none font-inter tabular-nums"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.015em',
                fontVariantNumeric: 'tabular-nums',
              }}
              autoFocus
            />
            <div className="flex gap-1 justify-center">
              <button
                type="submit"
                className="bg-[#032F73] hover:bg-blue-900 text-white text-[10px] font-black px-2.5 py-1 rounded shadow-xs transition-colors"
              >
                <Check className="w-3 h-3 inline mr-0.5" /> Simpan
              </button>
              <button
                type="button"
                onClick={handleSetToday}
                className="bg-amber-900 hover:bg-amber-950 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xs transition-colors"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setIsEditingDate(false)}
                className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        ) : (
          <div
            onClick={handleOpenEdit}
            title="Klik untuk ubah tanggal Hari Ini"
            className="cursor-pointer group flex items-center justify-center gap-1.5 w-full py-0.5"
          >
            <span
              className="text-base lg:text-lg font-bold tracking-tight text-white font-inter tabular-nums drop-shadow-sm group-hover:text-yellow-100"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.015em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {currentDateText}
            </span>
            <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-yellow-200 transition-opacity" />
          </div>
        )}
      </div>

      {/* KOTAK 2 (JOB AKTIF): Header #032F73 (Dark Navy) & Body Background Putih dengan angka besar */}
      <div
        id="card-sidebar-job-aktif"
        className="w-full rounded-xl overflow-hidden shadow-md border-2 border-[#032F73] flex flex-col bg-white"
      >
        {/* Header Atas: #032F73 dengan teks JOB AKTIF */}
        <div className="w-full bg-[#032F73] py-1.5 px-3 text-center">
          <h2
            className="text-white font-bold text-sm lg:text-base tracking-widest uppercase font-inter"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            JOB AKTIF
          </h2>
        </div>

        {/* Body Bawah: Background Putih dengan angka jumlah job aktif berukuran ekstra besar (Oswald 800) */}
        <div className="w-full bg-white py-2 flex items-center justify-center">
          <span
            className="text-6xl lg:text-7xl xl:text-8xl text-[#032F73] font-oswald tabular-nums leading-none drop-shadow-xs"
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {activeJobsCount}
          </span>
        </div>
      </div>

      {/* PANEL GAMBAR K3 / SAFETY (Vertikal - Background #032F73 Dark Navy Blue) */}
      <div
        id="panel-k3-safety-vertical"
        className="flex-1 w-full rounded-xl bg-[#032F73] border-2 border-blue-950 p-1 shadow-md flex flex-col justify-center items-center overflow-hidden relative group"
      >
        {/* Tombol Perintah Ganti / Upload Gambar K3 yang Selalu Tersedia */}
        {onOpenUploadModal && (
          <button
            onClick={() => onOpenUploadModal('k3')}
            title="Upload / Ganti Gambar K3"
            className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#032F73]/90 hover:bg-[#EA7A2D] text-white border border-white/40 shadow-md backdrop-blur-xs transition-all hover:scale-105 active:scale-95"
          >
            <Camera className="w-3.5 h-3.5 text-yellow-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider font-inter">Ganti Gambar</span>
          </button>
        )}

        {/* Konten Gambar K3 Diperbesar Maksimal */}
        {customK3PosterUrl && useCustomK3Image ? (
          <div
            onClick={() => onOpenUploadModal && onOpenUploadModal('k3')}
            className="w-full h-full flex-1 flex items-center justify-center p-1 cursor-pointer relative overflow-hidden group/img"
            title="Klik untuk ganti gambar K3"
          >
            <img
              src={customK3PosterUrl}
              alt="Gambar K3"
              className="w-full h-full object-contain rounded-lg shadow-sm transition-transform duration-200 group-hover/img:scale-[1.02]"
            />
            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-[#032F73]/70 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold gap-1.5 rounded-lg transition-opacity pointer-events-none">
              <ImageIcon className="w-6 h-6 text-yellow-300" />
              <span className="font-inter font-bold uppercase tracking-wider text-[11px]">Klik untuk Ganti Gambar</span>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onOpenUploadModal && onOpenUploadModal('k3')}
            className="w-full h-full flex-1 flex flex-col justify-center items-center cursor-pointer relative group/img p-1"
            title="Klik untuk upload / ganti gambar K3"
          >
            <K3SafetyIcons />
            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-[#032F73]/70 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold gap-1.5 rounded-lg transition-opacity pointer-events-none">
              <ImageIcon className="w-6 h-6 text-yellow-300" />
              <span className="font-inter font-bold uppercase tracking-wider text-[11px]">Unggah Poster K3 Asli</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
