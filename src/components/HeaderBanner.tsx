import React, { useEffect, useState } from 'react';
import { PupukKaltimLogo, WeldingShopLogo } from './BrandLogos';
import {
  Maximize2,
  Minimize2,
  PlusCircle,
  Play,
  Pause,
  RefreshCw,
  History,
  Image as ImageIcon,
  Cloud,
  CheckCircle2,
  Database,
  FolderArchive,
  KeyRound,
  ShieldCheck,
  HardDriveDownload,
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
  syncStatus?: 'connected' | 'saving' | 'synced-cloud' | 'offline';
  connectedClients?: number;
  onForceSyncServer?: () => void;
  onOpenArchiveModal?: (tab?: 'finish' | 'deleted') => void;
  onOpenPinSettings?: () => void;
  archiveFinishCount?: number;
  archiveDeletedCount?: number;
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
  syncStatus = 'connected',
  connectedClients = 1,
  onForceSyncServer,
  onOpenArchiveModal,
  onOpenPinSettings,
  archiveFinishCount = 0,
  archiveDeletedCount = 0,
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
      className="w-full flex-shrink-0 bg-white border-b-2 border-slate-200 shadow-sm px-4 lg:px-6 py-2 sm:py-2.5 flex items-center justify-between select-none relative z-20 min-h-[64px] lg:min-h-[72px] xl:min-h-[76px] overflow-hidden"
    >
      {/* Kolom Kiri: Logo PUPUK KALTIM dengan subteks SBU JASA PELAYANAN PABRIK */}
      <div className="flex items-center min-w-[230px] lg:min-w-[280px] flex-shrink-0">
        <PupukKaltimLogo
          className="h-11 lg:h-12 xl:h-13"
          customLogoUrl={companyLogoUrl}
          onClickUpload={() => onOpenUploadModal('company')}
        />
      </div>

      {/* Kolom Tengah: Banner Utama berujung melengkung warna #032F73 dengan teks bold putih DASHBOARD WELDING SHOP */}
      <div className="flex-1 max-w-3xl mx-3 lg:mx-6 flex items-center justify-center min-w-0">
        <div
          id="main-title-banner"
          className="w-full bg-[#032F73] text-white text-center py-2 lg:py-2.5 px-6 lg:px-10 rounded-full shadow-lg border-2 border-blue-900 flex items-center justify-center overflow-hidden"
        >
          <h1
            className="text-lg sm:text-xl md:text-2xl lg:text-[clamp(1.25rem,1.8vw,1.75rem)] uppercase text-white drop-shadow-md font-montserrat truncate tracking-wider sm:tracking-widest"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 900,
              letterSpacing: '0.06em',
            }}
          >
            DASHBOARD WELDING SHOP
          </h1>
        </div>
      </div>

      {/* Kolom Kanan: Logo WELDING SHOP (Ikon Pabrik/Las + Teks Orange WELDING SHOP) + Kontrol TV */}
      <div className="flex items-center gap-2 lg:gap-3.5 min-w-[230px] lg:min-w-[280px] justify-end flex-shrink-0">
        <WeldingShopLogo
          className="h-11 lg:h-12 xl:h-13"
          customLogoUrl={weldingLogoUrl}
          onClickUpload={() => onOpenUploadModal('welding')}
        />

        {/* Live Clock & Action Tools */}
        <div className="flex items-center gap-1.5 pl-2.5 border-l-2 border-slate-300">
          <div
            className="hidden xl:flex items-center gap-1.5 bg-slate-100 text-[#032F73] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-black font-inter tabular-nums shadow-2xs"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span>{currentTime || '--:--:--'}</span>
          </div>

          {/* Indikator Status Sinkronisasi Real-Time Server (Multi-Perangkat) */}
          <button
            id="btn-server-sync-status"
            type="button"
            onClick={onForceSyncServer}
            title={
              syncStatus === 'saving'
                ? 'Sedang menyimpan ke server...'
                : syncStatus === 'offline'
                ? 'Koneksi terputus. Klik untuk mencoba menghubungkan kembali.'
                : `Sinkronisasi server aktif (${connectedClients} perangkat terhubung). Setiap penambahan/edit data langsung muncul di semua perangkat dengan link ini.`
            }
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              syncStatus === 'saving'
                ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                : syncStatus === 'offline'
                ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                syncStatus === 'saving'
                  ? 'bg-amber-500 animate-spin'
                  : syncStatus === 'offline'
                  ? 'bg-rose-500'
                  : 'bg-emerald-500 animate-ping'
              }`}
            />
            <Database className={`w-3.5 h-3.5 ${syncStatus === 'saving' ? 'text-amber-600 animate-spin' : syncStatus === 'offline' ? 'text-rose-600' : 'text-emerald-600'}`} />
            <span className="truncate">
              {syncStatus === 'saving'
                ? 'Menyimpan...'
                : syncStatus === 'offline'
                ? 'Offline'
                : connectedClients > 1
                ? `Sync (${connectedClients} Perangkat)`
                : 'Sync Real-Time'}
            </span>
          </button>

          <button
            id="btn-toggle-cycle"
            onClick={onToggleAutoCycle}
            title={autoCycle ? 'Jeda Auto-Scroll' : 'Mulai Auto-Scroll'}
            className={`p-2 rounded-lg transition-all ${
              autoCycle
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            {autoCycle ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            id="btn-open-image-upload"
            onClick={() => onOpenUploadModal()}
            title="Upload Logo Perusahaan & Gambar Asli Petunjuk K3"
            className="p-2 rounded-lg bg-[#032F73] hover:bg-blue-900 text-yellow-300 transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* Tombol Arsip Data (Selesai & Dihapus) */}
          {onOpenArchiveModal && (
            <button
              id="btn-open-archive"
              onClick={() => onOpenArchiveModal()}
              title={`Buka Arsip Pekerjaan (${archiveFinishCount} Selesai, ${archiveDeletedCount} Dihapus)`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#032F73] hover:bg-blue-900 text-white font-bold text-xs sm:text-sm shadow-xs transition-all border border-blue-400/40"
            >
              <FolderArchive className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="hidden sm:inline whitespace-nowrap">Arsip Data</span>
              {(archiveFinishCount > 0 || archiveDeletedCount > 0) && (
                <span className="bg-amber-500 text-white font-black text-[10px] px-1.5 py-0.5 rounded-full tabular-nums">
                  {archiveFinishCount + archiveDeletedCount}
                </span>
              )}
            </button>
          )}

          {/* Tombol Pengaturan PIN Keamanan */}
          {onOpenPinSettings && (
            <button
              id="btn-open-pin-settings"
              onClick={onOpenPinSettings}
              title="Pengaturan PIN Keamanan (Proteksi Tambah, Edit, Hapus)"
              className="p-2 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-300 transition-colors"
            >
              <KeyRound className="w-4 h-4 text-amber-600" />
            </button>
          )}

          {/* Tombol Cadangan & Ekspor/Impor Data (.json / Excel) */}
          {onOpenExcelModal && (
            <button
              id="btn-open-backup-export"
              onClick={onOpenExcelModal}
              title="Cadangan & Ekspor/Impor Data (.json & Excel)"
              className="p-2 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-300 transition-colors"
            >
              <HardDriveDownload className="w-4 h-4 text-emerald-700" />
            </button>
          )}

          <button
            id="btn-open-add-job"
            onClick={onOpenAddJobModal}
            title="Tambah Job Baru atau Edit Data (Dilindungi PIN)"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EA7A2D] hover:bg-amber-600 text-white font-black text-xs sm:text-sm shadow-sm transition-all tracking-wide"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline whitespace-nowrap">+ Tambah Job / Edit Data</span>
          </button>



          <button
            id="btn-refresh-data"
            onClick={onRefreshData}
            title="Refresh Tampilan & Hitung Ulang Target (Data Tersimpan Aman)"
            className="p-2 rounded-lg bg-slate-100 hover:bg-blue-100 text-[#032F73] border border-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1054C1]' : ''}`} />
          </button>

          <button
            id="btn-fullscreen-toggle"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh TV (16:9)'}
            className="p-2 rounded-lg bg-[#032F73] hover:bg-blue-900 text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
