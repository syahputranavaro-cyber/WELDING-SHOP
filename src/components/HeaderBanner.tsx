import React, { useEffect, useState } from 'react';
import { PupukKaltimLogo, WeldingShopLogo } from './BrandLogos';
import {
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  PlusCircle,
  Play,
  Pause,
  RefreshCw,
  RotateCcw,
  History,
  Image as ImageIcon,
} from 'lucide-react';

interface HeaderBannerProps {
  onOpenExcelModal: () => void;
  onOpenAddJobModal: () => void;
  onOpenUploadModal: (tab?: 'company' | 'k3' | 'welding') => void;
  onRefreshData: () => void;
  onOpenResetModal: () => void;
  onRestoreBackup?: () => void;
  hasBackupAvailable?: boolean;
  isRefreshing?: boolean;
  autoCycle: boolean;
  onToggleAutoCycle: () => void;
  totalJobs: number;
  companyLogoUrl?: string | null;
  weldingLogoUrl?: string | null;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  onOpenExcelModal,
  onOpenAddJobModal,
  onOpenUploadModal,
  onRefreshData,
  onOpenResetModal,
  onRestoreBackup,
  hasBackupAvailable = false,
  isRefreshing = false,
  autoCycle,
  onToggleAutoCycle,
  companyLogoUrl,
  weldingLogoUrl,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  return (
    <header
      id="dashboard-header-banner"
      className="w-full bg-white border-b-2 border-slate-200 shadow-sm px-4 py-2.5 flex items-center justify-between select-none relative z-20"
    >
      {/* Kolom Kiri: Logo PUPUK KALTIM dengan subteks SBU JASA PELAYANAN PABRIK */}
      <div className="flex items-center min-w-[280px]">
        <PupukKaltimLogo
          customLogoUrl={companyLogoUrl}
          onClickUpload={() => onOpenUploadModal('company')}
        />
      </div>

      {/* Kolom Tengah: Banner Utama berujung melengkung warna #032F73 dengan teks bold putih DASHBOARD WELDING SHOP */}
      <div className="flex-1 max-w-2xl mx-4 flex items-center justify-center">
        <div
          id="main-title-banner"
          className="w-full bg-[#032F73] text-white text-center py-2.5 px-8 rounded-full shadow-md border border-blue-900 flex items-center justify-center"
        >
          <h1
            className="text-2xl md:text-3xl uppercase text-white drop-shadow-sm font-montserrat"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            DASHBOARD WELDING SHOP
          </h1>
        </div>
      </div>

      {/* Kolom Kanan: Logo WELDING SHOP (Ikon Pabrik/Las + Teks Orange WELDING SHOP) + Kontrol TV */}
      <div className="flex items-center gap-3 min-w-[280px] justify-end">
        <WeldingShopLogo
          customLogoUrl={weldingLogoUrl}
          onClickUpload={() => onOpenUploadModal('welding')}
        />

        {/* Live Clock & Action Tools */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
          <div
            className="hidden xl:flex items-center gap-1 bg-slate-100 text-[#032F73] px-2 py-1 rounded border border-slate-300 text-xs font-bold font-inter tabular-nums"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>{currentTime || '--:--:--'}</span>
          </div>

          <button
            id="btn-toggle-cycle"
            onClick={onToggleAutoCycle}
            title={autoCycle ? 'Jeda Auto-Scroll' : 'Mulai Auto-Scroll'}
            className={`p-1.5 rounded transition-all ${
              autoCycle
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            {autoCycle ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            id="btn-open-image-upload"
            onClick={() => onOpenUploadModal()}
            title="Upload Logo Perusahaan & Gambar Asli Petunjuk K3"
            className="p-1.5 rounded bg-[#032F73] hover:bg-blue-900 text-yellow-300 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-open-excel"
            onClick={onOpenExcelModal}
            title="Import / Export Excel (SheetJS)"
            className="p-1.5 rounded bg-[#032F73] hover:bg-blue-900 text-white transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-open-add-job"
            onClick={onOpenAddJobModal}
            title="Tambah Job Baru atau Edit Data"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EA7A2D] hover:bg-amber-600 text-white font-black text-xs shadow-xs transition-all tracking-wide"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline whitespace-nowrap">+ Tambah Job / Edit Data</span>
          </button>

          {hasBackupAvailable && onRestoreBackup && (
            <button
              id="btn-restore-backup"
              onClick={onRestoreBackup}
              title="Pulihkan Data Pekerjaan Sebelumnya (Ditemukan cadangan)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-xs transition-all animate-pulse"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden lg:inline whitespace-nowrap">Pulihkan Data Saya</span>
            </button>
          )}

          <button
            id="btn-refresh-data"
            onClick={onRefreshData}
            title="Refresh Tampilan & Hitung Ulang Target (Data Tersimpan Aman)"
            className="p-1.5 rounded bg-slate-100 hover:bg-blue-100 text-[#032F73] border border-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1054C1]' : ''}`} />
          </button>

          <button
            id="btn-reset-data"
            onClick={onOpenResetModal}
            title="Reset Data ke Default Pabrik (Dengan Konfirmasi)"
            className="p-1.5 rounded bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 border border-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-fullscreen-toggle"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh TV (16:9)'}
            className="p-1.5 rounded bg-[#032F73] hover:bg-blue-900 text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
