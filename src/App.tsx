/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { JobItem, BrandingImages, SyncStatusType, ArchivedJobItem, JobSortMode } from './types';
import { INITIAL_JOBS } from './data/initialJobs';
import { HeaderBanner } from './components/HeaderBanner';
import { SidebarSafety } from './components/SidebarSafety';
import { JobsTable } from './components/JobsTable';
import { ExcelManagerModal } from './components/ExcelManagerModal';
import { JobEditorModal } from './components/JobEditorModal';
import { ImageUploadModal } from './components/ImageUploadModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { FinishConfirmModal } from './components/FinishConfirmModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ArchiveModal } from './components/ArchiveModal';
import { useAuth } from './context/AuthContext';
import {
  calculateJobTarget,
  getSystemDateFormatted,
  evaluateJobHealth,
} from './utils/jobCalculations';
import {
  apiFetchVersion,
  apiFetchLiteState,
  apiFetchBranding,
  apiFetchArchives,
  apiUpsertSingleJob,
  apiSaveJobs,
  apiSaveBranding,
  apiSaveDate,
  apiSaveFullState,
  apiResetServer,
  apiFinishSingleJob,
  apiDeleteSingleJob,
  apiRestoreSingleJob,
  apiDeleteSingleArchive,
  type LiteStateData,
  type ApiWriteResult,
} from './utils/syncService';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

/**
 * Menghitung persentase target schedule secara otomatis untuk seluruh pekerjaan
 * berdasarkan tanggal acuan (reference date).
 */
function recalculateJobsSchedule(jobList: JobItem[], refDate: string): JobItem[] {
  return jobList.map((job) => {
    const calc = calculateJobTarget(job.start, job.finish, refDate);
    return {
      ...job,
      progress_target: calc.targetProgressPct,
    };
  });
}

/**
 * Menentukan tanggal efektif dashboard:
 * - Jika mode Otomatis (isAutoDate = true), SELALU gunakan tanggal sistem hari ini (WITA) secara real-time.
 * - Jika mode Simulasi (isAutoDate = false), gunakan tanggal manual dari server/pengguna.
 */
function resolveEffectiveDate(
  remoteIsAutoDate: unknown,
  remoteDateText: unknown,
  fallbackIsAuto: boolean,
  fallbackDate: string
): { effectiveIsAuto: boolean; effectiveDate: string } {
  const effectiveIsAuto =
    typeof remoteIsAutoDate === 'boolean' ? remoteIsAutoDate : fallbackIsAuto;

  if (effectiveIsAuto) {
    return {
      effectiveIsAuto: true,
      effectiveDate: getSystemDateFormatted(),
    };
  }

  const manualDate =
    typeof remoteDateText === 'string' && remoteDateText.trim()
      ? remoteDateText
      : fallbackDate;

  return {
    effectiveIsAuto: false,
    effectiveDate: manualDate,
  };
}

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
      if (Array.isArray(parsed)) {
        primary = parsed;
      }
    }
  } catch {
    // ignore
  }

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

  const backupExists = !!backup && (!primary || backup.length > primary.length);

  if (!primary) {
    primary = [];
  }

  return {
    initialList: primary,
    backupExists,
  };
}

export default function App() {
  const { user, isGuest, signOut } = useAuth();

  // Mode penentuan tanggal: Otomatis (Real-time WITA) vs Manual (Simulasi)
  const [isAutoDate, setIsAutoDate] = useState<boolean>(() => {
    try {
      const savedMode = localStorage.getItem('welding_shop_is_auto_date');
      if (savedMode !== null) return savedMode === 'true';
    } catch {
      // ignore
    }
    return true;
  });

  const [currentDateText, setCurrentDateText] = useState<string>(() => {
    try {
      const savedMode = localStorage.getItem('welding_shop_is_auto_date');
      const savedDate = localStorage.getItem('welding_shop_date_v3');
      if (savedMode === 'false' && savedDate) {
        return savedDate;
      }
    } catch {
      // ignore
    }
    return getSystemDateFormatted();
  });

  const applyCalculations = useCallback((jobList: JobItem[], refDate: string): JobItem[] => {
    return recalculateJobsSchedule(jobList, refDate);
  }, []);

  const { initialList, backupExists: initialBackupExists } = useMemo(
    () => getInitialJobsWithFallback(),
    []
  );

  // State status sinkronisasi & versi server
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('connected');
  const serverVersionRef = useRef<number>(0);
  const brandingUpdatedAtRef = useRef<string | null>(null);
  const currentDateRef = useRef<string>(currentDateText);
  const isAutoDateRef = useRef<boolean>(isAutoDate);

  useEffect(() => {
    currentDateRef.current = currentDateText;
  }, [currentDateText]);

  useEffect(() => {
    isAutoDateRef.current = isAutoDate;
  }, [isAutoDate]);

  // Daftar pekerjaan aktif
  const [jobs, setJobs] = useState<JobItem[]>(() => {
    return recalculateJobsSchedule(initialList, currentDateText);
  });
  const [hasBackupAvailable, setHasBackupAvailable] = useState<boolean>(initialBackupExists);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Branding (logo perusahaan, logo Welding Shop, poster K3 — dimuat terpisah agar polling super ringan)
  const [branding, setBranding] = useState<BrandingImages>(() => {
    try {
      const saved = localStorage.getItem('welding_shop_branding_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.updatedAt) {
          brandingUpdatedAtRef.current = parsed.updatedAt;
        }
        return parsed;
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
  const [sortMode, setSortMode] = useState<JobSortMode>(() => {
    try {
      const saved = localStorage.getItem('welding_shop_sort_mode');
      if (saved === 'priority' || saved === 'deadline' || saved === 'newest') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'priority';
  });

  const handleChangeSortMode = useCallback((mode: JobSortMode) => {
    setSortMode(mode);
    try {
      localStorage.setItem('welding_shop_sort_mode', mode);
    } catch {
      // ignore
    }
  }, []);

  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [isJobEditorOpen, setIsJobEditorOpen] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [imageModalTab, setImageModalTab] = useState<'company' | 'k3' | 'welding'>('company');
  const [jobToEdit, setJobToEdit] = useState<JobItem | null>(null);
  const [jobToFinish, setJobToFinish] = useState<JobItem | null>(null);
  const [jobToDelete, setJobToDelete] = useState<JobItem | null>(null);
  const [lastFinishedJob, setLastFinishedJob] = useState<JobItem | null>(null);

  // Arsip Data (dimuat secara on-demand dari server saat modal Arsip dibuka / ekspor cadangan)
  const [archiveFinish, setArchiveFinish] = useState<ArchivedJobItem[]>([]);
  const [archiveDeleted, setArchiveDeleted] = useState<ArchivedJobItem[]>([]);
  const [archiveFinishCount, setArchiveFinishCount] = useState<number>(0);
  const [archiveDeletedCount, setArchiveDeletedCount] = useState<number>(0);
  const archivesLoadedRef = useRef<boolean>(false);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [archiveModalInitialTab, setArchiveModalInitialTab] = useState<'finish' | 'deleted'>('finish');

  // Helper: Tangani kegagalan tulis ke server -> rollback state lokal & auto-logout jika 401
  const handleWriteFailure = useCallback(
    (res: ApiWriteResult, fallbackMessage: string, rollback?: () => void) => {
      if (rollback) {
        rollback();
      }
      setSyncStatus('offline');
      if (res.status === 401) {
        setToastMessage('Sesi Admin telah berakhir. Silakan login kembali.');
        signOut();
        return;
      }
      setToastMessage(res.message || fallbackMessage);
    },
    [signOut]
  );

  // Helper: Muat daftar arsip lengkap dari server secara on-demand
  const loadArchivesOnDemand = useCallback(async () => {
    const res = await apiFetchArchives();
    if (res && res.success) {
      setArchiveFinish(res.archiveFinish || []);
      setArchiveDeleted(res.archiveDeleted || []);
      setArchiveFinishCount((res.archiveFinish || []).length);
      setArchiveDeletedCount((res.archiveDeleted || []).length);
      archivesLoadedRef.current = true;
      return {
        finish: res.archiveFinish || [],
        deleted: res.archiveDeleted || [],
      };
    }
    return null;
  }, []);

  // Recalculate target progress whenever the dashboard reference date changes (manual or automatic)
  const handleUpdateDate = useCallback(
    (newDate: string, isManual: boolean = true) => {
      if (isGuest) return;
      const prevDate = currentDateText;
      const prevAuto = isAutoDate;

      setCurrentDateText(newDate);
      setIsAutoDate(!isManual);
      try {
        localStorage.setItem('welding_shop_is_auto_date', String(!isManual));
        localStorage.setItem('welding_shop_date_v3', newDate);
      } catch {
        // ignore
      }
      setJobs((prevJobs) => recalculateJobsSchedule(prevJobs, newDate));

      apiSaveDate(newDate, !isManual).then((res) => {
        if (res.success) {
          if (res.version) serverVersionRef.current = res.version;
          setSyncStatus('connected');
          if (isManual) {
            setToastMessage(`Mode Simulasi: Tanggal diatur ke ${newDate}. Disinkronkan ke seluruh perangkat.`);
          } else {
            setToastMessage(`Mode Otomatis Aktif: Mengikuti tanggal WITA real-time (${newDate}).`);
          }
        } else {
          handleWriteFailure(res, 'Gagal menyimpan tanggal ke server.', () => {
            setCurrentDateText(prevDate);
            setIsAutoDate(prevAuto);
            setJobs((prevJobs) => recalculateJobsSchedule(prevJobs, prevDate));
            try {
              localStorage.setItem('welding_shop_is_auto_date', String(prevAuto));
              localStorage.setItem('welding_shop_date_v3', prevDate);
            } catch {
              // ignore
            }
          });
        }
      });
    },
    [isGuest, currentDateText, isAutoDate, handleWriteFailure]
  );

  // Reset tanggal ke otomatis sistem WITA real-time
  const handleResetToAutoDate = useCallback(() => {
    if (isGuest) return;
    const prevDate = currentDateText;
    const prevAuto = isAutoDate;
    const today = getSystemDateFormatted();

    setIsAutoDate(true);
    setCurrentDateText(today);
    try {
      localStorage.setItem('welding_shop_is_auto_date', 'true');
      localStorage.setItem('welding_shop_date_v3', today);
    } catch {
      // ignore
    }
    setJobs((prevJobs) => recalculateJobsSchedule(prevJobs, today));

    apiSaveDate(today, true).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        setSyncStatus('connected');
        setToastMessage(`Kembali ke tanggal WITA otomatis: ${today}. Disinkronkan ke seluruh perangkat.`);
      } else {
        handleWriteFailure(res, 'Gagal menyinkronkan tanggal otomatis ke server.', () => {
          setCurrentDateText(prevDate);
          setIsAutoDate(prevAuto);
          setJobs((prevJobs) => recalculateJobsSchedule(prevJobs, prevDate));
        });
      }
    });
  }, [isGuest, currentDateText, isAutoDate, handleWriteFailure]);

  // Pengecekan otomatis pergantian hari real-time WITA (langsung saat aktif + setiap 30 detik + saat tab/TV bangun)
  useEffect(() => {
    if (!isAutoDate) return;

    const syncToToday = (showToast: boolean) => {
      const systemToday = getSystemDateFormatted();
      if (systemToday !== currentDateText) {
        setCurrentDateText(systemToday);
        setJobs((prevJobs) => recalculateJobsSchedule(prevJobs, systemToday));
        if (showToast) {
          setToastMessage(
            `Pergantian hari terdeteksi: Tanggal otomatis diperbarui ke ${systemToday}. Schedule diperbarui.`
          );
        }
      }
    };

    syncToToday(false);

    const interval = setInterval(() => syncToToday(true), 30000);
    const handleWake = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        syncToToday(false);
      }
    };
    document.addEventListener('visibilitychange', handleWake);
    window.addEventListener('focus', handleWake);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleWake);
      window.removeEventListener('focus', handleWake);
    };
  }, [isAutoDate, currentDateText]);

  // Toast auto-clear timer
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Persist active jobs to localStorage safely & keep backup
  useEffect(() => {
    try {
      localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(jobs));

      const hasCustomData =
        jobs.length > 3 ||
        jobs.some((j) => !INITIAL_JOBS.some((init) => init.id === j.id && init.deskripsi === j.deskripsi));

      if (hasCustomData) {
        localStorage.setItem('welding_shop_jobs_backup', JSON.stringify(jobs));
      }
    } catch {
      // ignore quota errors
    }
  }, [jobs]);

  useEffect(() => {
    try {
      localStorage.setItem('welding_shop_date_v3', currentDateText);
    } catch {
      // ignore
    }
  }, [currentDateText]);

  useEffect(() => {
    try {
      localStorage.setItem('welding_shop_branding_v3', JSON.stringify(branding));
    } catch {
      // ignore
    }
  }, [branding]);

  // Helper: Simpan seluruh state dengan pemecahan otomatis jika ukuran > 2.8 MB (aman batas payload 4.5 MB Vercel)
  const saveFullStateSafe = useCallback(
    async (payload: {
      jobs: JobItem[];
      archiveFinish: ArchivedJobItem[];
      archiveDeleted: ArchivedJobItem[];
      branding: BrandingImages;
      currentDateText: string;
      isAutoDate: boolean;
    }): Promise<ApiWriteResult> => {
      const approxBytes = JSON.stringify(payload).length;
      if (approxBytes < 2_800_000) {
        return apiSaveFullState(payload);
      }

      const coreRes = await apiSaveFullState({
        jobs: payload.jobs,
        archiveFinish: payload.archiveFinish,
        archiveDeleted: payload.archiveDeleted,
        currentDateText: payload.currentDateText,
        isAutoDate: payload.isAutoDate,
      });
      if (!coreRes.success) return coreRes;

      let latestVersion = coreRes.version;
      const brandingSteps: Partial<BrandingImages>[] = [
        { companyLogoUrl: payload.branding.companyLogoUrl },
        { weldingLogoUrl: payload.branding.weldingLogoUrl },
        {
          k3PosterUrl: payload.branding.k3PosterUrl,
          useCustomK3Image: payload.branding.useCustomK3Image,
        },
      ];

      for (const step of brandingSteps) {
        const bRes = await apiSaveBranding(step);
        if (!bRes.success) return bRes;
        if (bRes.version) latestVersion = bRes.version;
      }

      return { success: true, version: latestVersion };
    },
    []
  );

  // Helper: Simpan branding dengan pemecahan otomatis jika 3 gambar sekaligus > 2.8 MB
  const saveBrandingSafe = useCallback(
    async (updated: BrandingImages): Promise<ApiWriteResult> => {
      if (JSON.stringify({ branding: updated }).length < 2_800_000) {
        return apiSaveBranding(updated);
      }

      let latestVersion: number | undefined;
      let latestUpdatedAt: string | null | undefined;
      const steps: Partial<BrandingImages>[] = [
        { companyLogoUrl: updated.companyLogoUrl },
        { weldingLogoUrl: updated.weldingLogoUrl },
        {
          k3PosterUrl: updated.k3PosterUrl,
          useCustomK3Image: updated.useCustomK3Image,
        },
      ];
      for (const step of steps) {
        const res = await apiSaveBranding(step);
        if (!res.success) return res;
        if (res.version) latestVersion = res.version;
        if (res.brandingUpdatedAt) latestUpdatedAt = res.brandingUpdatedAt;
      }
      return { success: true, version: latestVersion, brandingUpdatedAt: latestUpdatedAt };
    },
    []
  );

  // Handler untuk menyimpan / menyinkronkan seluruh data secara paksa
  const handleForceSyncServer = useCallback(async () => {
    if (isGuest) return;
    setSyncStatus('saving');

    // Pastikan arsip sudah dimuat terlebih dahulu agar tidak menimpa arsip dengan array kosong
    let finishToSync = archiveFinish;
    let deletedToSync = archiveDeleted;
    if (!archivesLoadedRef.current) {
      const loaded = await loadArchivesOnDemand();
      if (loaded) {
        finishToSync = loaded.finish;
        deletedToSync = loaded.deleted;
      }
    }

    const res = await saveFullStateSafe({
      jobs,
      archiveFinish: finishToSync,
      archiveDeleted: deletedToSync,
      branding,
      currentDateText,
      isAutoDate,
    });
    if (res.success) {
      if (res.version) serverVersionRef.current = res.version;
      setSyncStatus('connected');
      setToastMessage('Seluruh data pekerjaan, arsip & gambar berhasil disimpan ke server & disinkronkan!');
    } else {
      handleWriteFailure(res, 'Gagal menghubungi server. Periksa koneksi jaringan.');
    }
  }, [
    isGuest,
    archiveFinish,
    archiveDeleted,
    loadArchivesOnDemand,
    saveFullStateSafe,
    jobs,
    branding,
    currentDateText,
    isAutoDate,
    handleWriteFailure,
  ]);

  // Real-Time Multi-Device Synchronization Engine (Lite Polling Hemat Bandwidth + SSE Express)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const applyLiteRemoteData = (
      lite: LiteStateData,
      showUpdateToast: boolean,
      customAction?: string
    ) => {
      if (!lite) return;
      const { effectiveIsAuto, effectiveDate } = resolveEffectiveDate(
        lite.isAutoDate,
        lite.currentDateText,
        isAutoDateRef.current,
        currentDateRef.current
      );

      setIsAutoDate(effectiveIsAuto);
      setCurrentDateText(effectiveDate);
      try {
        localStorage.setItem('welding_shop_is_auto_date', String(effectiveIsAuto));
        localStorage.setItem('welding_shop_date_v3', effectiveDate);
      } catch {
        // ignore
      }

      if (Array.isArray(lite.jobs)) {
        setJobs(recalculateJobsSchedule(lite.jobs, effectiveDate));
        try {
          localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(lite.jobs));
        } catch {
          // ignore
        }
      }

      if (typeof lite.archiveFinishCount === 'number') {
        setArchiveFinishCount(lite.archiveFinishCount);
      }
      if (typeof lite.archiveDeletedCount === 'number') {
        setArchiveDeletedCount(lite.archiveDeletedCount);
      }

      if (showUpdateToast) {
        setToastMessage(
          customAction
            ? `Terupdate dari perangkat lain: ${customAction}`
            : 'Data diperbarui otomatis dari server.'
        );
      }
    };

    const syncBrandingIfChanged = async (remoteBrandingUpdatedAt?: string | null, force = false) => {
      if (!isMounted) return;
      const shouldFetch =
        force ||
        (Boolean(remoteBrandingUpdatedAt) &&
          remoteBrandingUpdatedAt !== brandingUpdatedAtRef.current);
      if (!shouldFetch) return;

      const bRes = await apiFetchBranding();
      if (bRes && bRes.branding && isMounted) {
        brandingUpdatedAtRef.current = bRes.brandingUpdatedAt ?? bRes.branding.updatedAt ?? null;
        setBranding(bRes.branding);
        try {
          localStorage.setItem('welding_shop_branding_v3', JSON.stringify(bRes.branding));
        } catch {
          // ignore
        }
      }
    };

    const checkVersionAndSync = async () => {
      if (!isMounted) return;
      try {
        const vInfo = await apiFetchVersion();
        if (!vInfo) {
          if (isMounted) setSyncStatus('offline');
          return;
        }

        if (isMounted) {
          setSyncStatus('connected');
        }

        if (vInfo.version > serverVersionRef.current) {
          const liteRes = await apiFetchLiteState();
          if (liteRes && liteRes.data && isMounted) {
            serverVersionRef.current = liteRes.version;
            applyLiteRemoteData(liteRes.data, true);
            await syncBrandingIfChanged(liteRes.data.brandingUpdatedAt, false);
          }
        } else if (
          vInfo.brandingUpdatedAt &&
          vInfo.brandingUpdatedAt !== brandingUpdatedAtRef.current
        ) {
          await syncBrandingIfChanged(vInfo.brandingUpdatedAt, true);
        }
      } catch {
        if (isMounted) setSyncStatus('offline');
      }
    };

    function setupSSE() {
      try {
        eventSource = new EventSource('/api/events');

        eventSource.onopen = () => {
          if (isMounted) setSyncStatus('connected');
        };

        eventSource.onmessage = (event) => {
          if (!isMounted || !event.data) return;
          try {
            const payload = JSON.parse(event.data);

            if (
              payload.type === 'SYNC' ||
              payload.type === 'UPDATE' ||
              payload.type?.startsWith('UPDATE_') ||
              payload.type === 'RESET'
            ) {
              const incomingVersion = payload.version;
              if (incomingVersion > serverVersionRef.current) {
                serverVersionRef.current = incomingVersion;
                if (payload.lite) {
                  applyLiteRemoteData(payload.lite, Boolean(payload.action), payload.action);
                }
                if (payload.branding) {
                  brandingUpdatedAtRef.current = payload.branding.updatedAt ?? null;
                  setBranding(payload.branding);
                  try {
                    localStorage.setItem('welding_shop_branding_v3', JSON.stringify(payload.branding));
                  } catch {
                    // ignore
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error parsing SSE event:', e);
          }
        };

        eventSource.onerror = () => {
          if (isMounted) setSyncStatus('offline');
        };
      } catch (e) {
        console.warn('EventSource tidak dapat diinisialisasi:', e);
      }
    }

    async function initSync() {
      let supportsSSE = true;
      try {
        // Ambil data RINGAN (hanya jobs + tanggal + hitungan arsip) terlebih dahulu agar TV tampil instan
        const liteRes = await apiFetchLiteState();
        if (!isMounted) return;

        if (liteRes && liteRes.data) {
          supportsSSE = liteRes.supportsSSE !== false;
          serverVersionRef.current = liteRes.version || 1;
          setSyncStatus('connected');
          applyLiteRemoteData(liteRes.data, false);

          // Ambil branding sekali saat buka awal (atau jika branding server lebih baru dari cache lokal)
          const hasCachedBranding = Boolean(
            brandingUpdatedAtRef.current &&
              liteRes.data.brandingUpdatedAt === brandingUpdatedAtRef.current
          );
          if (!hasCachedBranding) {
            await syncBrandingIfChanged(liteRes.data.brandingUpdatedAt, true);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat state awal:', err);
      }

      if (!isMounted) return;

      if (supportsSSE) {
        setupSSE();
      }

      // Polling ringan (hanya 1 row version check): 4 detik di Express, 15 detik di Vercel Serverless
      const pollMs = supportsSSE ? 4000 : 15000;
      pollInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        checkVersionAndSync();
      }, pollMs);
    }

    initSync();

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        checkVersionAndSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Handler: Ekspor Cadangan Lengkap (.json) — memuat arsip segar dari server terlebih dahulu
  const handleExportBackupJson = useCallback(async () => {
    let finishData = archiveFinish;
    let deletedData = archiveDeleted;
    const loaded = await loadArchivesOnDemand();
    if (loaded) {
      finishData = loaded.finish;
      deletedData = loaded.deleted;
    }

    const fullBackup = {
      appName: 'Dashboard Welding Shop - PT Pupuk Kaltim',
      version: '3.1',
      exportDate: new Date().toISOString(),
      currentDateText,
      isAutoDate,
      jobs,
      archiveFinish: finishData,
      archiveDeleted: deletedData,
      branding,
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-dashboard-welding-shop-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastMessage('File cadangan lengkap (.json) berhasil diunduh!');
  }, [jobs, archiveFinish, archiveDeleted, branding, currentDateText, isAutoDate, loadArchivesOnDemand]);

  // Handler: Impor Cadangan Lengkap (.json)
  const handleImportBackupJson = useCallback(
    (importedData: any) => {
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Format file tidak valid');
      }

      const source =
        importedData.data && typeof importedData.data === 'object'
          ? importedData.data
          : importedData;

      const prevJobs = jobs;
      const prevFinish = archiveFinish;
      const prevDeleted = archiveDeleted;
      const prevBranding = branding;
      const prevDate = currentDateText;
      const prevAuto = isAutoDate;

      const resolvedIsAutoDate =
        typeof source.isAutoDate === 'boolean' ? source.isAutoDate : isAutoDate;
      const resolvedDateText = resolvedIsAutoDate
        ? getSystemDateFormatted()
        : typeof source.currentDateText === 'string' && source.currentDateText
        ? source.currentDateText
        : currentDateText;

      const nextJobs = Array.isArray(source.jobs)
        ? recalculateJobsSchedule(source.jobs, resolvedDateText)
        : jobs;
      const nextFinish = Array.isArray(source.archiveFinish) ? source.archiveFinish : archiveFinish;
      const nextDeleted = Array.isArray(source.archiveDeleted)
        ? source.archiveDeleted
        : archiveDeleted;
      const nextBranding =
        source.branding && typeof source.branding === 'object' ? source.branding : branding;

      setJobs(nextJobs);
      setArchiveFinish(nextFinish);
      setArchiveDeleted(nextDeleted);
      setArchiveFinishCount(nextFinish.length);
      setArchiveDeletedCount(nextDeleted.length);
      setBranding(nextBranding);
      setIsAutoDate(resolvedIsAutoDate);
      setCurrentDateText(resolvedDateText);

      setSyncStatus('saving');
      saveFullStateSafe({
        jobs: nextJobs,
        archiveFinish: nextFinish,
        archiveDeleted: nextDeleted,
        branding: nextBranding,
        currentDateText: resolvedDateText,
        isAutoDate: resolvedIsAutoDate,
      }).then((res) => {
        if (res.success) {
          if (res.version) serverVersionRef.current = res.version;
          archivesLoadedRef.current = true;
          setSyncStatus('connected');
          setToastMessage(
            `Berhasil memulihkan ${nextJobs.length} pekerjaan & ${nextFinish.length + nextDeleted.length} arsip ke database!`
          );
        } else {
          handleWriteFailure(
            res,
            'Gagal menyimpan cadangan ke server. Data lokal dikembalikan ke kondisi sebelumnya.',
            () => {
              setJobs(prevJobs);
              setArchiveFinish(prevFinish);
              setArchiveDeleted(prevDeleted);
              setArchiveFinishCount(prevFinish.length);
              setArchiveDeletedCount(prevDeleted.length);
              setBranding(prevBranding);
              setCurrentDateText(prevDate);
              setIsAutoDate(prevAuto);
            }
          );
        }
      });
    },
    [
      saveFullStateSafe,
      currentDateText,
      jobs,
      archiveFinish,
      archiveDeleted,
      branding,
      isAutoDate,
      handleWriteFailure,
    ]
  );

  // Ringkasan pekerjaan aktif (On Track / Delay / HOLD) untuk sidebar
  const activeJobsCount = jobs.filter(
    (j) => j.status?.toUpperCase() !== 'SELESAI' || j.progress_actual < 100
  ).length;

  const completedJobsCount = jobs.filter(
    (j) => j.status?.toUpperCase() === 'SELESAI' || j.progress_actual >= 100
  ).length;

  const sidebarSummary = useMemo(() => {
    let onTrackCount = 0;
    let delayCount = 0;
    let holdCount = 0;

    for (const job of jobs) {
      const evalResult = evaluateJobHealth(job, currentDateText);
      if (evalResult.health === 'HOLD') {
        holdCount += 1;
      } else if (evalResult.health === 'DELAY' || evalResult.health === 'OVERDUE') {
        delayCount += 1;
      } else {
        onTrackCount += 1;
      }
    }

    return {
      onTrackCount,
      delayCount,
      holdCount,
    };
  }, [jobs, currentDateText]);

  // Handlers
  const handleOpenUploadModal = (tab: 'company' | 'k3' | 'welding' = 'company') => {
    if (isGuest) return;
    setImageModalTab(tab);
    setIsImageModalOpen(true);
  };

  const handleSaveBranding = (updated: BrandingImages) => {
    if (isGuest) return;
    const prevBranding = branding;
    setBranding(updated);
    setSyncStatus('saving');
    saveBrandingSafe(updated).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        if (res.brandingUpdatedAt) {
          brandingUpdatedAtRef.current = res.brandingUpdatedAt;
          setBranding((curr) => ({ ...curr, updatedAt: res.brandingUpdatedAt || undefined }));
        }
        setSyncStatus('connected');
        setToastMessage('Branding berhasil disimpan & disinkronkan ke semua perangkat.');
      } else {
        handleWriteFailure(res, 'Gagal menyimpan branding ke server.', () => {
          setBranding(prevBranding);
        });
      }
    });
  };

  const handleOpenAddJob = () => {
    if (isGuest) return;
    setJobToEdit(null);
    setIsJobEditorOpen(true);
  };

  const handleOpenEditJob = (job: JobItem) => {
    if (isGuest) return;
    setJobToEdit(job);
    setIsJobEditorOpen(true);
  };

  // Multi-Admin Safe: Tambah / Edit 1 pekerjaan (hanya upsert 1 baris di database + rollback jika gagal)
  const handleSaveJob = (job: JobItem, updatedRefDate?: string) => {
    if (isGuest) return;
    const targetRefDate = updatedRefDate || currentDateText;
    const prevJobs = jobs;

    if (updatedRefDate && updatedRefDate !== currentDateText) {
      setCurrentDateText(updatedRefDate);
    }

    const jobWithTarget: JobItem = {
      ...job,
      progress_target: calculateJobTarget(job.start, job.finish, targetRefDate).targetProgressPct,
    };

    const existsIndex = prevJobs.findIndex((j) => j.id === jobWithTarget.id);
    const optimisticList =
      existsIndex >= 0
        ? prevJobs.map((j) => (j.id === jobWithTarget.id ? jobWithTarget : j))
        : [jobWithTarget, ...prevJobs];

    setJobs(applyCalculations(optimisticList, targetRefDate));
    setSyncStatus('saving');

    apiUpsertSingleJob(jobWithTarget, `Pekerjaan "${jobWithTarget.deskripsi}" disimpan`).then(
      (res) => {
        if (res.success) {
          if (res.version) serverVersionRef.current = res.version;
          if (Array.isArray(res.jobs)) {
            setJobs(applyCalculations(res.jobs, targetRefDate));
          }
          setSyncStatus('connected');
          setToastMessage(`Pekerjaan "${jobWithTarget.deskripsi}" berhasil disimpan & disinkronkan.`);
        } else {
          handleWriteFailure(
            res,
            'Gagal menyimpan perubahan ke server. Tampilan dikembalikan.',
            () => setJobs(prevJobs)
          );
        }
      }
    );
  };

  // Multi-Admin Safe: Edit Cepat Progress Actual pada 1 pekerjaan + rollback otomatis jika gagal
  const handleQuickUpdateActual = (job: JobItem, nextActual: number) => {
    if (isGuest) return;
    const prevJobs = jobs;
    const clampedActual = Number(Math.min(100, Math.max(0, nextActual)).toFixed(2));
    const updatedJob: JobItem = {
      ...job,
      progress_actual: clampedActual,
    };

    setJobs(applyCalculations(prevJobs.map((j) => (j.id === job.id ? updatedJob : j)), currentDateText));
    setSyncStatus('saving');

    apiUpsertSingleJob(
      updatedJob,
      `Progress Actual "${job.deskripsi}" diperbarui ke ${clampedActual}%`
    ).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        if (Array.isArray(res.jobs)) {
          setJobs(applyCalculations(res.jobs, currentDateText));
        }
        setSyncStatus('connected');
        setToastMessage(`Actual "${job.deskripsi}" diperbarui ke ${clampedActual}%.`);
      } else {
        handleWriteFailure(
          res,
          'Gagal menyimpan perubahan Actual ke server. Nilai dikembalikan.',
          () => setJobs(prevJobs)
        );
      }
    });
  };

  const handleRequestDeleteJob = (id: number) => {
    if (isGuest) return;
    const job = jobs.find((j) => j.id === id);
    if (job) {
      setJobToDelete(job);
    }
  };

  // Multi-Admin Safe: Hapus 1 pekerjaan -> arsipkan + rollback otomatis jika gagal
  const handleConfirmDeleteJob = (job: JobItem) => {
    if (isGuest) return;
    const prevJobs = jobs;
    const prevDeleted = archiveDeleted;
    const prevDeletedCount = archiveDeletedCount;
    const id = job.id;
    const desc = job.deskripsi || `Pekerjaan #${id}`;

    const deletedItem: ArchivedJobItem = {
      ...job,
      archivedAt: new Date().toISOString(),
      archiveType: 'DELETED',
      deleteReason: 'Dihapus dari dashboard',
    };

    setJobs(prevJobs.filter((j) => j.id !== id));
    setArchiveDeleted([deletedItem, ...prevDeleted.filter((a) => a.id !== id)]);
    setArchiveDeletedCount(prevDeletedCount + 1);
    setSyncStatus('saving');

    apiDeleteSingleJob(
      deletedItem,
      deletedItem.deleteReason,
      `Pekerjaan "${desc}" dihapus & dipindahkan ke arsip`
    ).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        if (Array.isArray(res.jobs)) {
          setJobs(applyCalculations(res.jobs, currentDateText));
        }
        setSyncStatus('connected');
        setToastMessage(`Pekerjaan "${desc}" dihapus & tersimpan aman di Arsip Dihapus.`);
      } else {
        handleWriteFailure(res, 'Gagal menghapus data di server. Data dikembalikan.', () => {
          setJobs(prevJobs);
          setArchiveDeleted(prevDeleted);
          setArchiveDeletedCount(prevDeletedCount);
        });
      }
    });
  };

  const handleRequestFinish = (job: JobItem) => {
    if (isGuest) return;
    setJobToFinish(job);
  };

  // Multi-Admin Safe: Tandai 1 pekerjaan Finish -> arsipkan + rollback otomatis jika gagal
  const handleConfirmFinish = (job: JobItem) => {
    if (isGuest) return;
    const prevJobs = jobs;
    const prevFinish = archiveFinish;
    const prevFinishCount = archiveFinishCount;

    const archivedItem: ArchivedJobItem = {
      ...job,
      progress_actual: 100,
      status: 'SELESAI',
      archivedAt: new Date().toISOString(),
      archiveType: 'FINISH',
    };

    setJobs(prevJobs.filter((j) => j.id !== job.id));
    setArchiveFinish([archivedItem, ...prevFinish.filter((a) => a.id !== job.id)]);
    setArchiveFinishCount(prevFinishCount + 1);
    setLastFinishedJob(job);
    setSyncStatus('saving');

    apiFinishSingleJob(
      archivedItem,
      `Pekerjaan "${job.deskripsi}" selesai & diarsipkan`
    ).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        if (Array.isArray(res.jobs)) {
          setJobs(applyCalculations(res.jobs, currentDateText));
        }
        setSyncStatus('connected');
        setToastMessage(`Pekerjaan "${job.deskripsi}" telah FINISH dan tersimpan di Arsip Selesai.`);
      } else {
        setLastFinishedJob(null);
        handleWriteFailure(res, 'Gagal menyimpan status Finish ke server. Data dikembalikan.', () => {
          setJobs(prevJobs);
          setArchiveFinish(prevFinish);
          setArchiveFinishCount(prevFinishCount);
        });
      }
    });
  };

  // Multi-Admin Safe: Pulihkan 1 pekerjaan dari Arsip
  const handleRestoreFromArchive = (item: ArchivedJobItem) => {
    if (isGuest) return;
    const prevJobs = jobs;
    const prevFinish = archiveFinish;
    const prevDeleted = archiveDeleted;
    const prevFinishCount = archiveFinishCount;
    const prevDeletedCount = archiveDeletedCount;

    const { archivedAt, archiveType, deleteReason, ...restoredRaw } = item;
    const restoredJob: JobItem = {
      ...(restoredRaw as JobItem),
      status: String(restoredRaw.status || '').toUpperCase() === 'HOLD' ? 'HOLD' : 'I/P',
    };

    if (archiveType === 'FINISH') {
      setArchiveFinish(prevFinish.filter((a) => a.id !== item.id));
      setArchiveFinishCount(Math.max(0, prevFinishCount - 1));
    } else {
      setArchiveDeleted(prevDeleted.filter((a) => a.id !== item.id));
      setArchiveDeletedCount(Math.max(0, prevDeletedCount - 1));
    }

    setJobs(applyCalculations([restoredJob, ...prevJobs.filter((j) => j.id !== item.id)], currentDateText));
    setSyncStatus('saving');

    apiRestoreSingleJob(
      item,
      archiveType,
      `Pekerjaan "${item.deskripsi}" dipulihkan ke dashboard`
    ).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        if (Array.isArray(res.jobs)) {
          setJobs(applyCalculations(res.jobs, currentDateText));
        }
        setSyncStatus('connected');
        setToastMessage(`Pekerjaan "${item.deskripsi}" berhasil dipulihkan ke dashboard aktif.`);
      } else {
        handleWriteFailure(res, 'Gagal memulihkan data di server.', () => {
          setJobs(prevJobs);
          setArchiveFinish(prevFinish);
          setArchiveDeleted(prevDeleted);
          setArchiveFinishCount(prevFinishCount);
          setArchiveDeletedCount(prevDeletedCount);
        });
      }
    });
  };

  // Multi-Admin Safe: Hapus permanen 1 item arsip
  const handlePermanentDeleteFromArchive = (item: ArchivedJobItem) => {
    if (isGuest) return;
    const prevFinish = archiveFinish;
    const prevDeleted = archiveDeleted;
    const prevFinishCount = archiveFinishCount;
    const prevDeletedCount = archiveDeletedCount;

    if (item.archiveType === 'FINISH') {
      setArchiveFinish(prevFinish.filter((a) => a.id !== item.id));
      setArchiveFinishCount(Math.max(0, prevFinishCount - 1));
    } else {
      setArchiveDeleted(prevDeleted.filter((a) => a.id !== item.id));
      setArchiveDeletedCount(Math.max(0, prevDeletedCount - 1));
    }

    apiDeleteSingleArchive(
      item.id,
      item.archiveType,
      `Pekerjaan "${item.deskripsi}" dihapus permanen`
    ).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        setSyncStatus('connected');
        setToastMessage(`Pekerjaan "${item.deskripsi}" dihapus permanen dari arsip.`);
      } else {
        handleWriteFailure(res, 'Gagal menghapus permanen di server.', () => {
          setArchiveFinish(prevFinish);
          setArchiveDeleted(prevDeleted);
          setArchiveFinishCount(prevFinishCount);
          setArchiveDeletedCount(prevDeletedCount);
        });
      }
    });
  };

  const handleOpenArchiveModal = (tab: 'finish' | 'deleted' = 'finish') => {
    setArchiveModalInitialTab(tab);
    setIsArchiveModalOpen(true);
    loadArchivesOnDemand();
  };

  const handleUndoFinish = () => {
    if (!lastFinishedJob || isGuest) return;
    const restored = lastFinishedJob;
    const prevJobs = jobs;
    const prevFinish = archiveFinish;
    const prevFinishCount = archiveFinishCount;

    const archivedRef: ArchivedJobItem = {
      ...restored,
      archivedAt: new Date().toISOString(),
      archiveType: 'FINISH',
    };

    setJobs(applyCalculations([restored, ...prevJobs.filter((j) => j.id !== restored.id)], currentDateText));
    setArchiveFinish(prevFinish.filter((a) => a.id !== restored.id));
    setArchiveFinishCount(Math.max(0, prevFinishCount - 1));
    setLastFinishedJob(null);

    apiRestoreSingleJob(
      archivedRef,
      'FINISH',
      `Pekerjaan "${restored.deskripsi}" dikembalikan`
    ).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        if (Array.isArray(res.jobs)) {
          setJobs(applyCalculations(res.jobs, currentDateText));
        }
        setSyncStatus('connected');
        setToastMessage(`Pekerjaan "${restored.deskripsi}" berhasil dikembalikan ke dashboard.`);
      } else {
        handleWriteFailure(res, 'Gagal mengembalikan pekerjaan di server.', () => {
          setJobs(prevJobs);
          setArchiveFinish(prevFinish);
          setArchiveFinishCount(prevFinishCount);
        });
      }
    });
  };

  const handleImportJobs = (importedJobs: JobItem[]) => {
    if (isGuest) return;
    const prevJobs = jobs;
    const calculated = applyCalculations(importedJobs, currentDateText);
    setJobs(calculated);
    setSyncStatus('saving');

    apiSaveJobs(calculated, 'Impor data pekerjaan dari Excel').then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        setSyncStatus('connected');
        setToastMessage(`${calculated.length} data pekerjaan berhasil dimuat & disinkronkan.`);
      } else {
        handleWriteFailure(res, 'Gagal menyimpan impor Excel ke server. Data dikembalikan.', () => {
          setJobs(prevJobs);
        });
      }
    });
  };

  /**
   * REFRESH DATA (RINGAN & AMAN):
   * Mengambil data aktif + branding terbaru dari server tanpa mengunduh ratusan arsip.
   */
  const handleRefreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [liteRes, brandRes] = await Promise.all([apiFetchLiteState(), apiFetchBranding()]);
      if (liteRes && liteRes.data) {
        serverVersionRef.current = liteRes.version;
        setSyncStatus('connected');
        const sData = liteRes.data;
        const { effectiveIsAuto, effectiveDate } = resolveEffectiveDate(
          sData.isAutoDate,
          sData.currentDateText,
          isAutoDate,
          currentDateText
        );

        setIsAutoDate(effectiveIsAuto);
        setCurrentDateText(effectiveDate);
        try {
          localStorage.setItem('welding_shop_is_auto_date', String(effectiveIsAuto));
          localStorage.setItem('welding_shop_date_v3', effectiveDate);
        } catch {
          // ignore
        }

        if (Array.isArray(sData.jobs)) {
          setJobs(recalculateJobsSchedule(sData.jobs, effectiveDate));
        }
        setArchiveFinishCount(sData.archiveFinishCount || 0);
        setArchiveDeletedCount(sData.archiveDeletedCount || 0);

        if (brandRes && brandRes.branding) {
          brandingUpdatedAtRef.current = brandRes.brandingUpdatedAt ?? brandRes.branding.updatedAt ?? null;
          setBranding(brandRes.branding);
        }

        setToastMessage(
          liteRes.supportsSSE === false
            ? 'Data berhasil disegarkan dari database cloud.'
            : 'Data berhasil disegarkan dari server.'
        );
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 450);
    }
  }, [currentDateText, isAutoDate]);

  const handleRestoreBackup = useCallback(() => {
    if (isGuest) return;
    const prevJobs = jobs;
    const fallbackKeys = ['welding_shop_jobs_backup', 'welding_shop_jobs_v2', 'welding_shop_jobs'];
    for (const k of fallbackKeys) {
      try {
        const val = localStorage.getItem(k);
        if (val) {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const calculated = applyCalculations(parsed, currentDateText);
            setJobs(calculated);
            apiSaveJobs(calculated, 'Pemulihan data cadangan').then((res) => {
              if (res.success) {
                if (res.version) serverVersionRef.current = res.version;
                setSyncStatus('connected');
                setToastMessage(`Berhasil memulihkan ${calculated.length} pekerjaan dari data cadangan!`);
                setHasBackupAvailable(false);
              } else {
                handleWriteFailure(res, 'Gagal memulihkan data cadangan ke server.', () => {
                  setJobs(prevJobs);
                });
              }
            });
            return;
          }
        }
      } catch {
        // ignore
      }
    }
    setToastMessage('Tidak ditemukan data cadangan untuk dipulihkan.');
  }, [isGuest, jobs, applyCalculations, currentDateText, handleWriteFailure]);

  const handleConfirmReset = useCallback(async () => {
    if (isGuest) return;
    const prevJobs = jobs;
    const prevDate = currentDateText;
    const prevAuto = isAutoDate;

    try {
      if (jobs.length > 0) {
        localStorage.setItem('welding_shop_jobs_backup', JSON.stringify(jobs));
        setHasBackupAvailable(true);
      }
    } catch {
      // ignore
    }

    const ref = getSystemDateFormatted();
    setIsAutoDate(true);
    setCurrentDateText(ref);
    setJobs([]);

    const res = await apiResetServer();
    if (res.success) {
      if (res.version) serverVersionRef.current = res.version;
      setSyncStatus('connected');
      setToastMessage(
        'Daftar pekerjaan aktif berhasil dikosongkan dan disinkronkan ke seluruh perangkat.'
      );
    } else {
      handleWriteFailure(res, 'Gagal mengosongkan daftar pekerjaan di server.', () => {
        setJobs(prevJobs);
        setCurrentDateText(prevDate);
        setIsAutoDate(prevAuto);
      });
    }
  }, [isGuest, jobs, currentDateText, isAutoDate, handleWriteFailure]);

  const handleToggleAutoCycle = () => {
    setAutoCycle((prev) => !prev);
  };

  return (
    <div
      id="welding-shop-tv-dashboard"
      className="h-screen h-[100dvh] max-h-screen max-h-[100dvh] w-screen max-w-full overflow-hidden bg-[#EFF3F8] flex flex-col select-none antialiased text-slate-900 relative"
    >
      {/* Toast Notification Floating Banner */}
      {toastMessage && (() => {
        const isErrorToast = /^(gagal|akses ditolak|error|tidak dapat|tidak ditemukan|sesi admin|terlalu banyak)/i.test(
          toastMessage.trim()
        );
        return (
          <div
            id="toast-notification-banner"
            className={`absolute top-[74px] right-4 z-50 flex items-center gap-2.5 text-white px-4 py-2.5 rounded-xl ring-1 ring-white/15 animate-in slide-in-from-top-2 duration-150 max-w-lg ${
              isErrorToast
                ? 'bg-rose-700 shadow-[0_12px_32px_-8px_rgba(190,18,60,0.45)]'
                : 'bg-[#032F73] shadow-[0_12px_32px_-8px_rgba(3,47,115,0.45)]'
            }`}
          >
            {isErrorToast ? (
              <AlertCircle className="w-4 h-4 text-rose-200 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            )}
            <span className="text-xs font-semibold leading-snug flex-1">{toastMessage}</span>
            {lastFinishedJob && !isErrorToast && (
              <button
                onClick={handleUndoFinish}
                className="ml-2 text-xs font-bold text-[#EA7A2D] hover:text-orange-200 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
              >
                Urungkan
              </button>
            )}
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-white/10 rounded-md text-white/75 hover:text-white transition-colors ml-1"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}

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
        onOpenArchiveModal={handleOpenArchiveModal}
        archiveFinishCount={archiveFinishCount}
        archiveDeletedCount={archiveDeletedCount}
        userEmail={user?.email}
        isReadOnly={isGuest}
        onSignOut={signOut}
      />

      {/* Body: Sidebar Kiri (Panel Informasi & K3) + Area Konten Utama (Tabel Jobs) */}
      <main className="flex-1 min-h-0 flex flex-row overflow-hidden relative w-full">
        {/* B. Sidebar Kiri (Panel Informasi & K3) */}
        <SidebarSafety
          activeJobsCount={activeJobsCount}
          completedJobsCount={completedJobsCount}
          totalJobsCount={jobs.length}
          onTrackCount={sidebarSummary.onTrackCount}
          delayCount={sidebarSummary.delayCount}
          holdCount={sidebarSummary.holdCount}
          currentDateText={currentDateText}
          isAutoDate={isAutoDate}
          onUpdateDateText={isGuest ? undefined : handleUpdateDate}
          onResetToAutoDate={isGuest ? undefined : handleResetToAutoDate}
          customK3PosterUrl={branding.k3PosterUrl}
          useCustomK3Image={branding.useCustomK3Image}
          onOpenUploadModal={isGuest ? undefined : handleOpenUploadModal}
          isReadOnly={isGuest}
        />

        {/* C. Area Konten Utama (Tabel Jobs & Schedule) */}
        <JobsTable
          jobs={jobs}
          currentDateText={currentDateText}
          sortMode={sortMode}
          onChangeSortMode={handleChangeSortMode}
          autoCycle={autoCycle}
          onToggleAutoCycle={handleToggleAutoCycle}
          onEditJob={isGuest ? undefined : handleOpenEditJob}
          onDeleteJob={isGuest ? undefined : handleRequestDeleteJob}
          onFinishJob={isGuest ? undefined : handleRequestFinish}
          onQuickUpdateActual={isGuest ? undefined : handleQuickUpdateActual}
          itemsPerPage={7}
        />
      </main>

      {/* Modals for SheetJS Excel, Job Management, Image Customization, and Confirmations */}
      <ExcelManagerModal
        isOpen={!isGuest && isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        currentJobs={jobs}
        onImportJobs={handleImportJobs}
        onResetToDefault={handleConfirmReset}
        branding={branding}
        onImportBackupJson={handleImportBackupJson}
        onExportBackupJson={handleExportBackupJson}
        onForceSaveServer={handleForceSyncServer}
        syncStatus={syncStatus}
      />

      <JobEditorModal
        isOpen={!isGuest && isJobEditorOpen}
        onClose={() => setIsJobEditorOpen(false)}
        jobToEdit={jobToEdit}
        onSaveJob={handleSaveJob}
        onDeleteJob={handleRequestDeleteJob}
        currentDashboardDate={currentDateText}
      />

      <ImageUploadModal
        isOpen={!isGuest && isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        branding={branding}
        onSaveBranding={handleSaveBranding}
        initialTab={imageModalTab}
      />

      <ResetConfirmModal
        isOpen={!isGuest && isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirmReset={handleConfirmReset}
        currentJobsCount={jobs.length}
      />

      <FinishConfirmModal
        isOpen={!isGuest && !!jobToFinish}
        onClose={() => setJobToFinish(null)}
        job={jobToFinish}
        onConfirmFinish={handleConfirmFinish}
      />

      <DeleteConfirmModal
        isOpen={!isGuest && !!jobToDelete}
        onClose={() => setJobToDelete(null)}
        job={jobToDelete}
        onConfirmDelete={handleConfirmDeleteJob}
      />

      {/* Modal Arsip Data (Dimuat on-demand saat dibuka) */}
      <ArchiveModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        archiveFinish={archiveFinish}
        archiveDeleted={archiveDeleted}
        onRestoreJob={handleRestoreFromArchive}
        onPermanentDeleteJob={handlePermanentDeleteFromArchive}
        initialTab={archiveModalInitialTab}
        isReadOnly={isGuest}
      />
    </div>
  );
}
