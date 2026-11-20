import React, { useEffect, useState } from 'react';
import { PupukKaltimLogo, WeldingShopLogo } from './BrandLogos';
import {
  Maximize2,
  Minimize2,
  PlusCircle,
  Play,
  Pause,
  RefreshCw,
  Image as ImageIcon,
  FolderArchive,
  HardDriveDownload,
  LogOut,
  Eye,
  Clock,
} from 'lucide-react';

interface HeaderBannerProps {
  onOpenExcelModal?: () => void;
  onOpenAddJobModal: () => void;
  onOpenUploadModal: (tab?: 'company' | 'k3' | 'welding') => void;
  onRefreshData: () => void;
  onOpenResetModal?: () => void;
  onRestoreBackup?: () => void;
  hasBackupAvailable?: boolean;
  isRefreshing?: boolean;
  autoCycle: boolean;
  onToggleAutoCycle: () => void;
  totalJobs: number;
  companyLogoUrl?: string | null;
  weldingLogoUrl?: string | null;
  onOpenArchiveModal?: (tab?: 'finish' | 'deleted') => void;
  archiveFinishCount?: number;
  archiveDeletedCount?: number;
  userEmail?: string | null;
  isReadOnly?: boolean;
  onSignOut?: () => void;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  onOpenExcelModal,
  onOpenAddJobModal,
  onOpenUploadModal,
  onRefreshData,
  isRefreshing = false,
  autoCycle,
  onToggleAutoCycle,
  companyLogoUrl,
  weldingLogoUrl,
  onOpenArchiveModal,
  archiveFinishCount = 0,
  archiveDeletedCount = 0,
  userEmail,
  isReadOnly = false,
  onSignOut,
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

  const totalArchiveCount = archiveFinishCount + archiveDeletedCount;

  return (
    <header
      id="dashboard-header-banner"
      className="w-full flex-shrink-0 bg-white border-b border-slate-200/90 shadow-[0_1px_3px_rgba(3,47,115,0.06)] px-4 lg:px-5 py-2 flex items-center justify-between select-none relative z-20 min-h-[64px] lg:min-h-[70px] overflow-hidden"
    >
      {/* Kolom Kiri: Logo PUPUK KALTIM */}
      <div className="flex items-center min-w-[210px] lg:min-w-[250px] flex-shrink-0">
        <PupukKaltimLogo
          className="h-10 lg:h-12"
          customLogoUrl={companyLogoUrl}
          onClickUpload={isReadOnly ? undefined : () => onOpenUploadModal('company')}
        />
      </div>

      {/* Kolom Tengah: Banner Utama Corporate Navy #032F73 */}
      <div className="flex-1 max-w-2xl mx-3 lg:mx-5 flex items-center justify-center min-w-0">
        <div
          id="main-title-banner"
          className="w-full bg-[#032F73] text-white text-center py-2 lg:py-2.5 px-6 lg:px-9 rounded-full shadow-[0_6px_18px_-6px_rgba(3,47,115,0.45)] ring-1 ring-inset ring-white/10 flex items-center justify-center overflow-hidden"
        >
          <h1 className="text-base sm:text-lg md:text-xl lg:text-[clamp(1.15rem,1.65vw,1.55rem)] font-extrabold uppercase text-white font-display truncate tracking-[0.08em]">
            DASHBOARD WELDING SHOP
          </h1>
        </div>
      </div>

      {/* Kolom Kanan: Logo WELDING SHOP + Jam & Kontrol */}
      <div className="flex items-center gap-2 lg:gap-3 min-w-[210px] lg:min-w-[250px] justify-end flex-shrink-0">
        <WeldingShopLogo
          className="h-10 lg:h-12"
          customLogoUrl={weldingLogoUrl}
          onClickUpload={isReadOnly ? undefined : () => onOpenUploadModal('welding')}
        />

        {/* Divider + Live Clock & Action Tools */}
        <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
          {/* Live Clock — crisp monospace tabular numerals */}
          <div className="hidden xl:flex items-center gap-1.5 text-[#032F73] px-2 py-1 text-xs sm:text-[13px] font-semibold font-mono-data tabular-nums whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-[#EA7A2D] flex-shrink-0" />
            <span>{currentTime || '--:--:--'}</span>
          </div>

          {/* Indikator Mode Tamu (View Only) — clean unboxed subtle text */}
          {isReadOnly && (
            <div
              id="badge-guest-view-only"
              title="Mode Tamu: Hanya dapat melihat dashboard tanpa mengubah data"
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-700 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5 text-[#EA7A2D] flex-shrink-0" />
              <span>View Only</span>
            </div>
          )}

          {/* Grouped Utility Controls */}
          <div className="flex items-center gap-1">
            <button
              id="btn-toggle-cycle"
              onClick={onToggleAutoCycle}
              title={autoCycle ? 'Jeda Auto-Scroll' : 'Mulai Auto-Scroll'}
              className={`p-2 rounded-lg border transition-colors ${
                autoCycle
                  ? 'bg-[#032F73]/8 border-[#032F73]/20 text-[#032F73] hover:bg-[#032F73]/14'
                  : 'bg-white border-slate-200/90 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {autoCycle ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
            </button>

            {!isReadOnly && (
              <button
                id="btn-open-image-upload"
                onClick={() => onOpenUploadModal()}
                title="Upload Logo Perusahaan & Gambar Asli Petunjuk K3"
                className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-[#032F73] border border-slate-200/90 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            )}

            {!isReadOnly && onOpenExcelModal && (
              <button
                id="btn-open-backup-export"
                onClick={onOpenExcelModal}
                title="Cadangan & Ekspor/Impor Data (.json & Excel)"
                className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-[#032F73] border border-slate-200/90 transition-colors"
              >
                <HardDriveDownload className="w-4 h-4" />
              </button>
            )}

            <button
              id="btn-refresh-data"
              onClick={onRefreshData}
              title="Refresh Tampilan & Hitung Ulang Target (Data Tersimpan Aman)"
              className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-[#032F73] border border-slate-200/90 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1054C1]' : ''}`} />
            </button>

            <button
              id="btn-fullscreen-toggle"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh TV (16:9)'}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-[#032F73] border border-slate-200/90 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Tombol Arsip Data (Selesai & Dihapus) */}
          {onOpenArchiveModal && (
            <button
              id="btn-open-archive"
              onClick={() => onOpenArchiveModal()}
              title={`Buka Arsip Pekerjaan (${archiveFinishCount} Selesai, ${archiveDeletedCount} Dihapus)`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#032F73] hover:bg-[#022154] text-white font-semibold text-xs sm:text-[13px] transition-colors whitespace-nowrap shrink-0"
            >
              <FolderArchive className="w-4 h-4 text-[#EA7A2D] flex-shrink-0" />
              <span className="hidden sm:inline">Arsip</span>
              {totalArchiveCount > 0 && (
                <span className="text-blue-200 font-mono-data text-xs tabular-nums">
                  ({totalArchiveCount})
                </span>
              )}
            </button>
          )}

          {/* Primary CTA: Tambah Job (Corporate Orange #EA7A2D) */}
          {!isReadOnly && (
            <button
              id="btn-open-add-job"
              onClick={onOpenAddJobModal}
              title="Tambah Job Baru atau Edit Data"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#EA7A2D] hover:bg-[#D96B1F] text-white font-bold text-xs sm:text-[13px] shadow-[0_2px_8px_-2px_rgba(234,122,45,0.55)] transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Tambah Job</span>
            </button>
          )}

          {onSignOut && (
            <button
              id="btn-sign-out"
              onClick={onSignOut}
              title={
                isReadOnly
                  ? 'Keluar dari Mode Tamu / Login Admin'
                  : userEmail
                  ? `Keluar (${userEmail})`
                  : 'Keluar Akun'
              }
              className="p-2 rounded-lg bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/90 hover:border-rose-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
