/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { JobItem, BrandingImages } from './types';
import { INITIAL_JOBS } from './data/initialJobs';
import { HeaderBanner } from './components/HeaderBanner';
import { SidebarSafety } from './components/SidebarSafety';
import { JobsTable } from './components/JobsTable';
import { ExcelManagerModal } from './components/ExcelManagerModal';
import { JobEditorModal } from './components/JobEditorModal';
import { ImageUploadModal } from './components/ImageUploadModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { FinishConfirmModal } from './components/FinishConfirmModal';
import { calculateJobTarget } from './utils/jobCalculations';
import { CheckCircle2, Info, X, History } from 'lucide-react';

/**
 * Load initial jobs with intelligent fallback check across storage keys
 * to protect user data from being lost.
 */
function getInitialJobsWithFallback(): { initialList: JobItem[]; backupExists: boolean } {
  let primary: JobItem[] | null = null;
  let backup: JobItem[] | null = null;

  try {
    const v3 = localStorage.getItem('welding_shop_jobs_v3');
    if (v3) {
      const parsed = JSON.parse(v3);
      if (Array.isArray(parsed) && parsed.length > 0) {
        primary = parsed;
      }
    }
  } catch {
    // ignore
  }

  // Check fallback backup keys
  const fallbackKeys = ['welding_shop_jobs_backup', 'welding_shop_jobs_v2', 'welding_shop_jobs'];
  for (const k of fallbackKeys) {
    try {
      const val = localStorage.getItem(k);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!backup || parsed.length > backup.length) {
            backup = parsed;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // If primary has fewer jobs than backup (e.g. user previously clicked reset by accident),
  // we can use backup or mark backupExists = true
  const backupExists = !!backup && (!primary || backup.length > primary.length);

  // If no primary exists at all, take backup or default
  if (!primary) {
    primary = backup || INITIAL_JOBS;
  }

  return {
    initialList: primary,
    backupExists,
  };
}

export default function App() {
  const [currentDateText, setCurrentDateText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('welding_shop_date_v3');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return '9 September 2026';
  });

  // Calculate target progress for a list of jobs based on reference date
  const applyCalculations = useCallback((jobList: JobItem[], refDate: string): JobItem[] => {
    return jobList.map((job) => {
      const calc = calculateJobTarget(job.start, job.finish, refDate);
      return {
        ...job,
        progress_target: calc.targetProgressPct,
      };
    });
  }, []);

  const { initialList, backupExists: initialBackupExists } = useMemo(
    () => getInitialJobsWithFallback(),
    []
  );

  const [jobs, setJobs] = useState<JobItem[]>(initialList);
  const [hasBackupAvailable, setHasBackupAvailable] = useState<boolean>(initialBackupExists);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Branding (Uploaded real company logo & K3 poster)
  const [branding, setBranding] = useState<BrandingImages>(() => {
    try {
      const saved = localStorage.getItem('welding_shop_branding_v3');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      companyLogoUrl: null,
      weldingLogoUrl: null,
      k3PosterUrl: null,
      useCustomK3Image: false,
    };
  });

  const [autoCycle, setAutoCycle] = useState<boolean>(true);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [isJobEditorOpen, setIsJobEditorOpen] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [imageModalTab, setImageModalTab] = useState<'company' | 'k3' | 'welding'>('company');
  const [jobToEdit, setJobToEdit] = useState<JobItem | null>(null);
  const [jobToFinish, setJobToFinish] = useState<JobItem | null>(null);
  const [lastFinishedJob, setLastFinishedJob] = useState<JobItem | null>(null);

  // Recalculate target progress whenever the dashboard reference date changes
  const handleUpdateDate = useCallback(
    (newDate: string) => {
      setCurrentDateText(newDate);
      setJobs((prevJobs) => applyCalculations(prevJobs, newDate));
      setToastMessage(`Tanggal referensi diubah ke ${newDate}. Kalkulasi otomatis diperbarui.`);
    },
    [applyCalculations]
  );

  // Toast auto-clear timer
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Persist jobs to localStorage safely & keep backup
  useEffect(() => {
    try {
      localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(jobs));

      // If user has custom jobs, keep a persistent backup copy
      const hasCustomData =
        jobs.length > 3 ||
        jobs.some((j) => !INITIAL_JOBS.some((init) => init.id === j.id && init.deskripsi === j.deskripsi));

      if (hasCustomData) {
        localStorage.setItem('welding_shop_jobs_backup', JSON.stringify(jobs));
      }
    } catch {
      // ignore
    }
  }, [jobs]);

  // Save date to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('welding_shop_date_v3', currentDateText);
    } catch {
      // ignore
    }
  }, [currentDateText]);

  // Save branding images to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('welding_shop_branding_v3', JSON.stringify(branding));
    } catch {
      // ignore
    }
  }, [branding]);

  // Active jobs count: count jobs that are either AKTIF or actual progress < 100
  const activeJobsCount = jobs.filter(
    (j) => j.status?.toUpperCase() === 'AKTIF' || j.progress_actual < 100
  ).length;

  const completedJobsCount = jobs.filter(
    (j) => j.status?.toUpperCase() === 'SELESAI' || j.progress_actual >= 100
  ).length;

  // Handlers
  const handleOpenUploadModal = (tab: 'company' | 'k3' | 'welding' = 'company') => {
    setImageModalTab(tab);
    setIsImageModalOpen(true);
  };

  const handleSaveBranding = (updated: BrandingImages) => {
    setBranding(updated);
  };

  const handleOpenAddJob = () => {
    setJobToEdit(null);
    setIsJobEditorOpen(true);
  };

  const handleOpenEditJob = (job: JobItem) => {
    setJobToEdit(job);
    setIsJobEditorOpen(true);
  };

  const handleSaveJob = (job: JobItem, updatedRefDate?: string) => {
    const targetRefDate = updatedRefDate || currentDateText;
    if (updatedRefDate && updatedRefDate !== currentDateText) {
      setCurrentDateText(updatedRefDate);
    }

    setJobs((prev) => {
      const existsIndex = prev.findIndex((j) => j.id === job.id);
      let updatedList: JobItem[];
      if (existsIndex >= 0) {
        updatedList = [...prev];
        updatedList[existsIndex] = job;
      } else {
        updatedList = [job, ...prev];
      }
      const recalculated = applyCalculations(updatedList, targetRefDate);
      try {
        localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(recalculated));
        localStorage.setItem('welding_shop_jobs_backup', JSON.stringify(recalculated));
      } catch {
        // ignore
      }
      return recalculated;
    });

    setToastMessage(`Pekerjaan "${job.deskripsi}" berhasil disimpan.`);
  };

  const handleDeleteJob = (id: number) => {
    setJobs((prev) => {
      const updated = prev.filter((j) => j.id !== id);
      try {
        localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    setToastMessage('Pekerjaan telah dihapus.');
  };

  const handleRequestFinish = (job: JobItem) => {
    setJobToFinish(job);
  };

  const handleConfirmFinish = (job: JobItem) => {
    const finishedJob: JobItem = {
      ...job,
      progress_actual: 100,
      status: 'SELESAI',
    };

    // Save to finished history in localStorage
    try {
      const finishedRaw = localStorage.getItem('welding_shop_finished_jobs');
      const finishedList: JobItem[] = finishedRaw ? JSON.parse(finishedRaw) : [];
      localStorage.setItem(
        'welding_shop_finished_jobs',
        JSON.stringify([finishedJob, ...finishedList.filter((j) => j.id !== job.id)])
      );
    } catch {
      // ignore
    }

    setLastFinishedJob(job);

    // Remove finished job from dashboard
    setJobs((prev) => {
      const updated = prev.filter((j) => j.id !== job.id);
      try {
        localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    setToastMessage(`Pekerjaan "${job.deskripsi}" telah FINISH dan dihapus dari dashboard.`);
  };

  const handleUndoFinish = () => {
    if (!lastFinishedJob) return;
    const restored = lastFinishedJob;
    setJobs((prev) => {
      const recalculated = applyCalculations([restored, ...prev], currentDateText);
      try {
        localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(recalculated));
      } catch {
        // ignore
      }
      return recalculated;
    });
    setLastFinishedJob(null);
    setToastMessage(`Pekerjaan "${restored.deskripsi}" berhasil dikembalikan ke dashboard.`);
  };

  const handleImportJobs = (importedJobs: JobItem[]) => {
    const calculated = applyCalculations(importedJobs, currentDateText);
    setJobs(calculated);
    try {
      localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(calculated));
      localStorage.setItem('welding_shop_jobs_backup', JSON.stringify(calculated));
    } catch {
      // ignore
    }
    setToastMessage(`${calculated.length} data pekerjaan berhasil dimuat.`);
  };

  /**
   * REFRESH DATA (AMAN & TIDAK MENGHAPUS DATA):
   * Menyegarkan kalkulasi target progress, memvalidasi penyimpanan lokal, dan menyegarkan tampilan.
   */
  const handleRefreshData = useCallback(() => {
    setIsRefreshing(true);
    setJobs((prevJobs) => {
      // Cek apakah ada data di localStorage yang lebih mutakhir
      let sourceList = prevJobs;
      try {
        const saved = localStorage.getItem('welding_shop_jobs_v3');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= prevJobs.length) {
            sourceList = parsed;
          }
        }
      } catch {
        // ignore
      }
      return applyCalculations(sourceList, currentDateText);
    });

    setToastMessage(`Tampilan & kalkulasi berhasil diperbarui. Seluruh ${jobs.length} pekerjaan tersimpan aman.`);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 450);
  }, [applyCalculations, currentDateText, jobs.length]);

  /**
   * PULIHKAN DATA CADANGAN (RESTORE BACKUP):
   * Mengembalikan data pekerjaan yang pernah disimpan jika pengguna secara tidak sengaja mereset data.
   */
  const handleRestoreBackup = useCallback(() => {
    const fallbackKeys = ['welding_shop_jobs_backup', 'welding_shop_jobs_v2', 'welding_shop_jobs'];
    for (const k of fallbackKeys) {
      try {
        const val = localStorage.getItem(k);
        if (val) {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const calculated = applyCalculations(parsed, currentDateText);
            setJobs(calculated);
            localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(calculated));
            setToastMessage(`Berhasil memulihkan ${calculated.length} pekerjaan dari data cadangan!`);
            setHasBackupAvailable(false);
            return;
          }
        }
      } catch {
        // ignore
      }
    }
    setToastMessage('Tidak ditemukan data cadangan untuk dipulihkan.');
  }, [applyCalculations, currentDateText]);

  /**
   * KONFIRMASI RESET DATA KE DEFAULT:
   * Menyimpan cadangan data saat ini terlebih dahulu, lalu mereset ke 3 pekerjaan awal.
   */
  const handleConfirmReset = useCallback(() => {
    try {
      if (jobs.length > 0) {
        localStorage.setItem('welding_shop_jobs_backup', JSON.stringify(jobs));
        setHasBackupAvailable(true);
      }
    } catch {
      // ignore
    }

    const ref = '9 September 2026';
    setCurrentDateText(ref);
    const initial = applyCalculations(INITIAL_JOBS, ref);
    setJobs(initial);
    try {
      localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(initial));
      localStorage.setItem('welding_shop_date_v3', ref);
    } catch {
      // ignore
    }

    setToastMessage(
      'Data direset ke 3 pekerjaan awal default pabrik. Data lama tersimpan di cadangan dan dapat dipulihkan.'
    );
  }, [applyCalculations, jobs]);

  const handleToggleAutoCycle = () => {
    setAutoCycle((prev) => !prev);
  };

  return (
    <div
      id="welding-shop-tv-dashboard"
      className="h-screen w-screen overflow-hidden bg-[#F8FAFC] flex flex-col font-sans select-none antialiased text-slate-900 relative"
      style={{
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        letterSpacing: '0.015em',
      }}
    >
      {/* Toast Notification Floating Banner */}
      {toastMessage && (
        <div
          id="toast-notification-banner"
          className="absolute top-16 right-4 z-50 flex items-center gap-2.5 bg-[#032F73] text-white px-4 py-2.5 rounded-xl shadow-2xl border border-blue-400/30 animate-in slide-in-from-top-2 duration-200 max-w-lg"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-bold leading-tight flex-1">{toastMessage}</span>
          {lastFinishedJob && (
            <button
              onClick={handleUndoFinish}
              className="ml-2 text-xs font-black uppercase text-amber-300 hover:text-amber-100 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded transition-colors whitespace-nowrap"
            >
              Urungkan
            </button>
          )}
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* A. Header Utama (3 Kolom Horizontal) */}
      <HeaderBanner
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        onOpenAddJobModal={handleOpenAddJob}
        onOpenUploadModal={handleOpenUploadModal}
        onRefreshData={handleRefreshData}
        onOpenResetModal={() => setIsResetConfirmOpen(true)}
        onRestoreBackup={handleRestoreBackup}
        hasBackupAvailable={hasBackupAvailable}
        isRefreshing={isRefreshing}
        autoCycle={autoCycle}
        onToggleAutoCycle={handleToggleAutoCycle}
        totalJobs={jobs.length}
        companyLogoUrl={branding.companyLogoUrl}
        weldingLogoUrl={branding.weldingLogoUrl}
      />

      {/* Body: Sidebar Kiri (Panel Informasi & K3) + Area Konten Utama (Tabel Jobs) */}
      <main className="flex-1 flex flex-row overflow-hidden relative">
        {/* B. Sidebar Kiri (Panel Informasi & K3) */}
        <SidebarSafety
          activeJobsCount={activeJobsCount}
          completedJobsCount={completedJobsCount}
          totalJobsCount={jobs.length}
          currentDateText={currentDateText}
          onUpdateDateText={handleUpdateDate}
          customK3PosterUrl={branding.k3PosterUrl}
          useCustomK3Image={branding.useCustomK3Image}
          onOpenUploadModal={handleOpenUploadModal}
        />

        {/* C. Area Konten Utama (Tabel Jobs & Schedule) */}
        <JobsTable
          jobs={jobs}
          autoCycle={autoCycle}
          onToggleAutoCycle={handleToggleAutoCycle}
          onEditJob={handleOpenEditJob}
          onDeleteJob={handleDeleteJob}
          onFinishJob={handleRequestFinish}
          itemsPerPage={5}
        />
      </main>

      {/* Modals for SheetJS Excel, Job Management, Image Customization, and Reset Confirmation */}
      <ExcelManagerModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        currentJobs={jobs}
        onImportJobs={handleImportJobs}
        onResetToDefault={handleConfirmReset}
      />

      <JobEditorModal
        isOpen={isJobEditorOpen}
        onClose={() => setIsJobEditorOpen(false)}
        jobToEdit={jobToEdit}
        onSaveJob={handleSaveJob}
        onDeleteJob={handleDeleteJob}
        currentDashboardDate={currentDateText}
      />

      <ImageUploadModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        branding={branding}
        onSaveBranding={handleSaveBranding}
        initialTab={imageModalTab}
      />

      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirmReset={handleConfirmReset}
        currentJobsCount={jobs.length}
      />

      <FinishConfirmModal
        isOpen={!!jobToFinish}
        onClose={() => setJobToFinish(null)}
        job={jobToFinish}
        onConfirmFinish={handleConfirmFinish}
      />
    </div>
  );
}
