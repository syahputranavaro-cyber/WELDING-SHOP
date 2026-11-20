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
import { ArchiveModal } from './components/ArchiveModal';
import { useAuth } from './context/AuthContext';
import {
  calculateJobTarget,
  getSystemDateFormatted,
  evaluateJobHealth,
  countFinishedThisMonth,
} from './utils/jobCalculations';
import {
  apiFetchState,
  apiFetchVersion,
  apiSaveJobs,
  apiSaveBranding,
  apiSaveDate,
  apiSaveFullState,
  apiResetServer,
  apiSaveArchive,
  apiSaveJobFinish,
  apiSaveJobDelete,
  apiSaveJobRestore,
} from './utils/syncService';
import { CheckCircle2, Info, X, History, Wifi } from 'lucide-react';

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
 * - Jika mode Otomatis (isAutoDate = true), SELALU gunakan tanggal sistem hari ini secara real-time
 *   agar tidak pernah tertimpa tanggal lama yang tersimpan di server/database.
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
 * Mengambil arsip awal dengan proteksi fallback dari primary & backup localStorage
 */
function getInitialArchivesWithFallback(): {
  initialFinish: ArchivedJobItem[];
  initialDeleted: ArchivedJobItem[];
} {
  let finishList: ArchivedJobItem[] = [];
  let deletedList: ArchivedJobItem[] = [];

  try {
    const saved = localStorage.getItem('welding_shop_archive_finish');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) finishList = parsed;
    }
  } catch {}

  if (finishList.length === 0) {
    try {
      const backup = localStorage.getItem('welding_shop_archive_finish_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        if (Array.isArray(parsed) && parsed.length > 0) finishList = parsed;
      }
    } catch {}
  }

  try {
    const saved = localStorage.getItem('welding_shop_archive_deleted');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) deletedList = parsed;
    }
  } catch {}

  if (deletedList.length === 0) {
    try {
      const backup = localStorage.getItem('welding_shop_archive_deleted_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        if (Array.isArray(parsed) && parsed.length > 0) deletedList = parsed;
      }
    } catch {}
  }

  return { initialFinish: finishList, initialDeleted: deletedList };
}

/**
 * Menggabungkan data arsip dari browser & server secara cerdas:
 * Menjamin tidak ada satupun arsip yang hilang meskipun server di-restart atau browser di-refresh.
 */
function mergeArchives(clientList: ArchivedJobItem[], serverList: ArchivedJobItem[]): ArchivedJobItem[] {
  const map = new Map<number | string, ArchivedJobItem>();
  if (Array.isArray(serverList)) {
    for (const item of serverList) {
      if (item && item.id != null) map.set(item.id, item);
    }
  }
  if (Array.isArray(clientList)) {
    for (const item of clientList) {
      if (item && item.id != null) {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.archivedAt || 0).getTime();
    const timeB = new Date(b.archivedAt || 0).getTime();
    return timeB - timeA;
  });
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
  // Mode penentuan tanggal: Otomatis (Real-time Sistem) vs Manual (Simulasi)
  const [isAutoDate, setIsAutoDate] = useState<boolean>(() => {
    try {
      const savedMode = localStorage.getItem('welding_shop_is_auto_date');
      if (savedMode !== null) return savedMode === 'true';
    } catch {
      // ignore
    }
    return true; // Default selalu OTOMATIS
  });

  const [currentDateText, setCurrentDateText] = useState<string>(() => {
    try {
      const savedMode = localStorage.getItem('welding_shop_is_auto_date');
      const savedDate = localStorage.getItem('welding_shop_date_v3');
      if (savedMode === 'false' && savedDate) {
        return savedDate; // Gunakan tanggal manual jika mode simulasi aktif
      }
    } catch {
      // ignore
    }
    return getSystemDateFormatted(); // Default otomatis mengambil tanggal sistem real-time (contoh: "11 September 2026")
  });

  // Calculate target progress for a list of jobs based on reference date
  const applyCalculations = useCallback((jobList: JobItem[], refDate: string): JobItem[] => {
    return recalculateJobsSchedule(jobList, refDate);
  }, []);

  const { initialList, backupExists: initialBackupExists } = useMemo(
    () => getInitialJobsWithFallback(),
    []
  );

  // State status sinkronisasi server & multi-device
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('connected');
  const [connectedClients, setConnectedClients] = useState<number>(1);
  const serverVersionRef = useRef<number>(0);

  // Kalkulasi awal persentase bar SCHEDULE seluruh pekerjaan mengikuti tanggal hari ini
  const [jobs, setJobs] = useState<JobItem[]>(() => {
    return recalculateJobsSchedule(initialList, currentDateText);
  });
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
  const [lastFinishedJob, setLastFinishedJob] = useState<JobItem | null>(null);

  // Arsip Data (Selesai dan Dihapus dipisahkan secara terpisah dengan proteksi fallback)
  const initialArchives = useMemo(() => getInitialArchivesWithFallback(), []);
  const [archiveFinish, setArchiveFinish] = useState<ArchivedJobItem[]>(initialArchives.initialFinish);
  const [archiveDeleted, setArchiveDeleted] = useState<ArchivedJobItem[]>(initialArchives.initialDeleted);

  // PIN Keamanan (Proteksi Tambah, Edit, Hapus)
  const [pinCode, setPinCode] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('welding_shop_pincode');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return '1234';
  });

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [archiveModalInitialTab, setArchiveModalInitialTab] = useState<'finish' | 'deleted'>('finish');

  // Recalculate target progress whenever the dashboard reference date changes (manual or automatic)
  const handleUpdateDate = useCallback(
    (newDate: string, isManual: boolean = true) => {
      if (isGuest) return;
      setCurrentDateText(newDate);
      setIsAutoDate(!isManual);
      try {
        localStorage.setItem('welding_shop_is_auto_date', String(!isManual));
        localStorage.setItem('welding_shop_date_v3', newDate);
      } catch {
        // ignore
      }
      setJobs((prevJobs) => recalculateJobsSchedule(prevJobs, newDate));
      // Sinkronisasi perubahan tanggal ke server untuk seluruh perangkat
      apiSaveDate(newDate, !isManual).then((res) => {
        if (res.success && res.version) serverVersionRef.current = res.version;
      });
      if (isManual) {
        setToastMessage(`Mode Simulasi: Tanggal diatur ke ${newDate}. Disinkronkan ke seluruh perangkat.`);
      } else {
        setToastMessage(`Mode Otomatis Aktif: Mengikuti tanggal sistem real-time (${newDate}).`);
      }
    },
    [isGuest]
  );

  // Reset tanggal ke otomatis sistem real-time
  const handleResetToAutoDate = useCallback(() => {
    if (isGuest) return;
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
    // Sinkronisasi reset tanggal ke server untuk seluruh perangkat
    apiSaveDate(today, true).then((res) => {
      if (res.success && res.version) serverVersionRef.current = res.version;
    });
    setToastMessage(`Kembali ke tanggal sistem otomatis: ${today}. Disinkronkan ke seluruh perangkat.`);
  }, [isGuest]);

  // Pengecekan otomatis pergantian hari real-time (langsung saat aktif + setiap 30 detik + saat tab/TV bangun)
  // Ketika jam melewati tengah malam (00:00), tanggal "HARI INI" dan grafik SCHEDULE seluruh job otomatis bertambah/ter-update
  useEffect(() => {
    if (!isAutoDate) return;

    const syncToToday = (showToast: boolean) => {
      const systemToday = getSystemDateFormatted();
      if (systemToday !== currentDateText) {
        setCurrentDateText(systemToday);
        setJobs((prevJobs) => recalculateJobsSchedule(prevJobs, systemToday));
        if (showToast) {
          setToastMessage(
            `Pergantian hari terdeteksi: Tanggal sistem otomatis diperbarui ke ${systemToday}. Schedule diperbarui.`
          );
        }
      }
    };

    // Sinkronkan seketika jika tanggal masih tertinggal dari tanggal sistem hari ini
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

  // Persist archive to localStorage & backup storage secara otomatis
  useEffect(() => {
    try {
      localStorage.setItem('welding_shop_archive_finish', JSON.stringify(archiveFinish));
      if (archiveFinish.length > 0) {
        localStorage.setItem('welding_shop_archive_finish_backup', JSON.stringify(archiveFinish));
      }
    } catch {
      // ignore
    }
  }, [archiveFinish]);

  useEffect(() => {
    try {
      localStorage.setItem('welding_shop_archive_deleted', JSON.stringify(archiveDeleted));
      if (archiveDeleted.length > 0) {
        localStorage.setItem('welding_shop_archive_deleted_backup', JSON.stringify(archiveDeleted));
      }
    } catch {
      // ignore
    }
  }, [archiveDeleted]);

  // Helper: Simpan seluruh state dengan pemecahan otomatis jika ukuran > 2.8 MB (aman batas payload 4.5 MB Vercel)
  const saveFullStateSafe = useCallback(
    async (payload: {
      jobs: JobItem[];
      archiveFinish: ArchivedJobItem[];
      archiveDeleted: ArchivedJobItem[];
      branding: BrandingImages;
      pinCode: string;
      currentDateText: string;
      isAutoDate: boolean;
    }): Promise<{ success: boolean; version?: number; message?: string }> => {
      const approxBytes = JSON.stringify(payload).length;
      if (approxBytes < 2_800_000) {
        return apiSaveFullState(payload);
      }

      // 1. Kirim data inti (jobs, arsip, PIN, tanggal) tanpa gambar besar
      const coreRes = await apiSaveFullState({
        jobs: payload.jobs,
        archiveFinish: payload.archiveFinish,
        archiveDeleted: payload.archiveDeleted,
        pinCode: payload.pinCode,
        currentDateText: payload.currentDateText,
        isAutoDate: payload.isAutoDate,
      });
      if (!coreRes.success) return coreRes;

      let latestVersion = coreRes.version;

      // 2. Kirim gambar branding satu per satu agar masing-masing jauh di bawah 4.5 MB
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
    async (updated: BrandingImages): Promise<{ success: boolean; version?: number; message?: string }> => {
      if (JSON.stringify({ branding: updated }).length < 2_800_000) {
        return apiSaveBranding(updated);
      }

      let latestVersion: number | undefined;
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
      }
      return { success: true, version: latestVersion };
    },
    []
  );

  // Handler untuk menyimpan / menyinkronkan seluruh data secara paksa
  const handleForceSyncServer = useCallback(async () => {
    if (isGuest) return;
    setSyncStatus('saving');
    const res = await saveFullStateSafe({
      jobs,
      archiveFinish,
      archiveDeleted,
      branding,
      pinCode,
      currentDateText,
      isAutoDate,
    });
    if (res.success) {
      if (res.version) serverVersionRef.current = res.version;
      setSyncStatus('connected');
      setToastMessage('Seluruh data pekerjaan, arsip & gambar berhasil disimpan ke server & disinkronkan!');
    } else {
      setSyncStatus('offline');
      setToastMessage(res.message || 'Gagal menghubungi server. Periksa koneksi jaringan.');
    }
  }, [isGuest, saveFullStateSafe, jobs, archiveFinish, archiveDeleted, branding, pinCode, currentDateText, isAutoDate]);

  // Real-Time Multi-Device Synchronization Engine (SSE untuk Express + Polling Hemat Kuota untuk Vercel Serverless)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const applyRemoteData = (data: any, showUpdateToast: boolean, customAction?: string) => {
      if (!data) return;
      const { effectiveIsAuto, effectiveDate } = resolveEffectiveDate(
        data.isAutoDate,
        data.currentDateText,
        isAutoDate,
        currentDateText
      );

      setIsAutoDate(effectiveIsAuto);
      setCurrentDateText(effectiveDate);
      try {
        localStorage.setItem('welding_shop_is_auto_date', String(effectiveIsAuto));
        localStorage.setItem('welding_shop_date_v3', effectiveDate);
      } catch {}

      if (Array.isArray(data.jobs)) {
        setJobs(recalculateJobsSchedule(data.jobs, effectiveDate));
        try {
          localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(data.jobs));
        } catch {}
      }
      if (Array.isArray(data.archiveFinish)) {
        setArchiveFinish(data.archiveFinish);
        try {
          localStorage.setItem('welding_shop_archive_finish', JSON.stringify(data.archiveFinish));
        } catch {}
      }
      if (Array.isArray(data.archiveDeleted)) {
        setArchiveDeleted(data.archiveDeleted);
        try {
          localStorage.setItem('welding_shop_archive_deleted', JSON.stringify(data.archiveDeleted));
        } catch {}
      }
      if (typeof data.pinCode === 'string' && data.pinCode) {
        setPinCode(data.pinCode);
        try {
          localStorage.setItem('welding_shop_pincode', data.pinCode);
        } catch {}
      }
      if (data.branding) {
        setBranding(data.branding);
        try {
          localStorage.setItem('welding_shop_branding_v3', JSON.stringify(data.branding));
        } catch {}
      }
      if (showUpdateToast) {
        setToastMessage(
          customAction
            ? `⚡ Terupdate dari perangkat lain: ${customAction}`
            : '⚡ Data diperbarui otomatis dari server.'
        );
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
          if (vInfo.clientCount) setConnectedClients(vInfo.clientCount);
        }

        if (vInfo.version > serverVersionRef.current) {
          const fullRes = await apiFetchState();
          if (fullRes && fullRes.data && isMounted) {
            serverVersionRef.current = fullRes.version;
            applyRemoteData(fullRes.data, true);
          }
        }
      } catch {
        if (isMounted) setSyncStatus('offline');
      }
    };

    // 1. Hubungkan ke Server-Sent Events (SSE) hanya jika backend mendukung SSE (Express)
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
            if (payload.clientCount && isMounted) {
              setConnectedClients(payload.clientCount);
            }

            if (
              payload.type === 'SYNC' ||
              payload.type === 'UPDATE' ||
              payload.type?.startsWith('UPDATE_') ||
              payload.type === 'RESET'
            ) {
              const incomingVersion = payload.version;
              if (incomingVersion > serverVersionRef.current) {
                serverVersionRef.current = incomingVersion;
                applyRemoteData(payload.data, Boolean(payload.action), payload.action);
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

    // 2. Ambil data awal dari server lalu tentukan mode sinkronisasi (SSE vs Vercel Serverless Polling)
    async function initSync() {
      let supportsSSE = true;
      try {
        const res = await apiFetchState();
        if (!isMounted) return;

        if (res && res.data) {
          supportsSSE = res.supportsSSE !== false;
          serverVersionRef.current = res.version || 1;
          setConnectedClients(res.clientCount || 1);
          setSyncStatus('connected');

          const serverData = res.data;
          const isServerAuthoritative = (res.version || 1) > 1;
          const { effectiveIsAuto, effectiveDate } = resolveEffectiveDate(
            serverData.isAutoDate,
            serverData.currentDateText,
            isAutoDate,
            currentDateText
          );

          setIsAutoDate(effectiveIsAuto);
          setCurrentDateText(effectiveDate);
          try {
            localStorage.setItem('welding_shop_is_auto_date', String(effectiveIsAuto));
            localStorage.setItem('welding_shop_date_v3', effectiveDate);
          } catch {}

          if (Array.isArray(serverData.jobs)) {
            setJobs(recalculateJobsSchedule(serverData.jobs, effectiveDate));
            try {
              localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(serverData.jobs));
            } catch {}
          }
          const serverFinish = Array.isArray(serverData.archiveFinish) ? serverData.archiveFinish : [];
          const serverDeleted = Array.isArray(serverData.archiveDeleted) ? serverData.archiveDeleted : [];

          if (isServerAuthoritative || isGuest) {
            setArchiveFinish(serverFinish);
            setArchiveDeleted(serverDeleted);
            try {
              localStorage.setItem('welding_shop_archive_finish', JSON.stringify(serverFinish));
              localStorage.setItem('welding_shop_archive_deleted', JSON.stringify(serverDeleted));
            } catch {}
          } else {
            // Gunakan penggabungan cerdas (mergeArchives) hanya jika server masih di state awal (v1)
            setArchiveFinish((prevFinish) => {
              const merged = mergeArchives(prevFinish, serverFinish);
              if (merged.length > serverFinish.length) {
                apiSaveArchive(merged, serverDeleted, 'Sinkronisasi pemulihan arsip dari perangkat');
              }
              return merged;
            });

            setArchiveDeleted((prevDeleted) => {
              const merged = mergeArchives(prevDeleted, serverDeleted);
              if (merged.length > serverDeleted.length) {
                apiSaveArchive(serverFinish, merged, 'Sinkronisasi pemulihan arsip dari perangkat');
              }
              return merged;
            });
          }
          if (typeof serverData.pinCode === 'string' && serverData.pinCode) {
            setPinCode(serverData.pinCode);
            try {
              localStorage.setItem('welding_shop_pincode', serverData.pinCode);
            } catch {}
          }
          if (serverData.branding) {
            setBranding(serverData.branding);
            try {
              localStorage.setItem('welding_shop_branding_v3', JSON.stringify(serverData.branding));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Gagal memuat state awal:', err);
      }

      if (!isMounted) return;

      if (supportsSSE) {
        setupSSE();
      }

      // Polling 4 detik untuk server Express; 15 detik untuk Vercel Serverless agar hemat kuota Free Tier (4 TV 24/7 tetap aman)
      const pollMs = supportsSSE ? 4000 : 15000;
      pollInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        checkVersionAndSync();
      }, pollMs);
    }

    initSync();

    // Langsung sinkronkan ulang begitu tab/layar kembali aktif
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

  // Handler: Ekspor Cadangan Lengkap (.json)
  const handleExportBackupJson = useCallback(() => {
    const fullBackup = {
      appName: 'Dashboard Welding Shop - PT Pupuk Kaltim',
      version: '3.0',
      exportDate: new Date().toISOString(),
      currentDateText,
      isAutoDate,
      jobs,
      archiveFinish,
      archiveDeleted,
      branding,
      pinCode,
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
  }, [jobs, archiveFinish, archiveDeleted, branding, pinCode, currentDateText, isAutoDate]);

  // Handler: Impor Cadangan Lengkap (.json — mendukung file backup maupun langsung dari /api/state)
  const handleImportBackupJson = useCallback(
    (importedData: any) => {
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Format file tidak valid');
      }

      // Otomatis dukung format langsung dari endpoint /api/state ({ success, data: { ... } })
      const source =
        importedData.data && typeof importedData.data === 'object'
          ? importedData.data
          : importedData;

      const resolvedIsAutoDate =
        typeof source.isAutoDate === 'boolean' ? source.isAutoDate : isAutoDate;
      const resolvedDateText = resolvedIsAutoDate
        ? getSystemDateFormatted()
        : typeof source.currentDateText === 'string' && source.currentDateText
        ? source.currentDateText
        : currentDateText;

      let nextJobs = jobs;
      if (Array.isArray(source.jobs)) {
        nextJobs = recalculateJobsSchedule(source.jobs, resolvedDateText);
        setJobs(nextJobs);
        try {
          localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(nextJobs));
          localStorage.setItem('welding_shop_jobs_backup', JSON.stringify(nextJobs));
        } catch {}
      }

      const nextFinish = Array.isArray(source.archiveFinish) ? source.archiveFinish : archiveFinish;
      if (Array.isArray(source.archiveFinish)) {
        setArchiveFinish(nextFinish);
        try {
          localStorage.setItem('welding_shop_archive_finish', JSON.stringify(nextFinish));
          localStorage.setItem('welding_shop_archive_finish_backup', JSON.stringify(nextFinish));
        } catch {}
      }

      const nextDeleted = Array.isArray(source.archiveDeleted) ? source.archiveDeleted : archiveDeleted;
      if (Array.isArray(source.archiveDeleted)) {
        setArchiveDeleted(nextDeleted);
        try {
          localStorage.setItem('welding_shop_archive_deleted', JSON.stringify(nextDeleted));
          localStorage.setItem('welding_shop_archive_deleted_backup', JSON.stringify(nextDeleted));
        } catch {}
      }

      const nextBranding =
        source.branding && typeof source.branding === 'object' ? source.branding : branding;
      if (source.branding && typeof source.branding === 'object') {
        setBranding(nextBranding);
        try {
          localStorage.setItem('welding_shop_branding_v3', JSON.stringify(nextBranding));
        } catch {}
      }

      const nextPin =
        typeof source.pinCode === 'string' && source.pinCode ? source.pinCode : pinCode;
      if (typeof source.pinCode === 'string' && source.pinCode) {
        setPinCode(nextPin);
        try {
          localStorage.setItem('welding_shop_pincode', nextPin);
        } catch {}
      }

      if (typeof source.isAutoDate === 'boolean') {
        setIsAutoDate(source.isAutoDate);
      }
      setCurrentDateText(resolvedDateText);

      setSyncStatus('saving');
      saveFullStateSafe({
        jobs: nextJobs,
        archiveFinish: nextFinish,
        archiveDeleted: nextDeleted,
        branding: nextBranding,
        pinCode: nextPin,
        currentDateText: resolvedDateText,
        isAutoDate: resolvedIsAutoDate,
      }).then((res) => {
        if (res.success) {
          if (res.version) serverVersionRef.current = res.version;
          setSyncStatus('connected');
          setToastMessage(
            `Berhasil memulihkan ${nextJobs.length} pekerjaan & ${nextFinish.length + nextDeleted.length} arsip ke database!`
          );
        } else {
          setSyncStatus('offline');
          setToastMessage(res.message || 'Gagal menyimpan cadangan ke server. Cek konfigurasi Supabase.');
        }
      });
    },
    [saveFullStateSafe, currentDateText, jobs, archiveFinish, archiveDeleted, branding, pinCode, isAutoDate]
  );

  // Hitung ringkasan status pekerjaan aktif (I/P & HOLD) dan kesehatan jadwal
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

    const finishedThisMonthCount = countFinishedThisMonth(archiveFinish, currentDateText);

    return {
      onTrackCount,
      delayCount,
      holdCount,
      finishedThisMonthCount,
    };
  }, [jobs, archiveFinish, currentDateText]);

  // Handlers
  const handleOpenUploadModal = (tab: 'company' | 'k3' | 'welding' = 'company') => {
    if (isGuest) return;
    setImageModalTab(tab);
    setIsImageModalOpen(true);
  };

  const handleSaveBranding = (updated: BrandingImages) => {
    if (isGuest) return;
    setBranding(updated);
    setSyncStatus('saving');
    saveBrandingSafe(updated).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        setSyncStatus('connected');
        setToastMessage('Branding berhasil disimpan & disinkronkan ke semua perangkat.');
      } else {
        setSyncStatus('offline');
        setToastMessage(res.message || 'Gagal menyimpan branding ke server.');
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
      // Kirim pembaruan ke server agar seketika tampil di semua perangkat
      apiSaveJobs(recalculated, `Pekerjaan "${job.deskripsi}" disimpan`).then((res) => {
        if (res.success) {
          if (res.version) serverVersionRef.current = res.version;
          setSyncStatus('connected');
        } else {
          setSyncStatus('offline');
          setToastMessage(res.message || 'Gagal menyimpan perubahan ke server.');
        }
      });
      return recalculated;
    });

    setToastMessage(`Pekerjaan "${job.deskripsi}" berhasil disimpan & disinkronkan.`);
  };

  const handleDeleteJob = (id: number) => {
    if (isGuest) return;
    const job = jobs.find((j) => j.id === id);
    const desc = job ? job.deskripsi : `Pekerjaan #${id}`;

    let updatedDeleted = archiveDeleted;
    if (job) {
      const deletedItem: ArchivedJobItem = {
        ...job,
        archivedAt: new Date().toISOString(),
        archiveType: 'DELETED',
        deleteReason: 'Dihapus dari dashboard',
      };
      updatedDeleted = [deletedItem, ...archiveDeleted.filter((a) => a.id !== id)];
      setArchiveDeleted(updatedDeleted);
    }

    const updatedJobs = jobs.filter((j) => j.id !== id);
    setJobs(updatedJobs);

    // Simpan secara ATOMIK dalam 1 transaksi ke server (tidak ada race condition)
    apiSaveJobDelete(
      updatedJobs,
      updatedDeleted,
      archiveFinish,
      `Pekerjaan "${desc}" dihapus & dipindahkan ke arsip`
    ).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        setSyncStatus('connected');
      } else {
        setSyncStatus('offline');
        setToastMessage(res.message || 'Gagal menghapus data di server.');
      }
    });

    setToastMessage(`Pekerjaan "${desc}" dihapus & tersimpan aman di Arsip Dihapus.`);
  };

  const handleRequestFinish = (job: JobItem) => {
    if (isGuest) return;
    setJobToFinish(job);
  };

  const handleConfirmFinish = (job: JobItem) => {
    const finishedJob: JobItem = {
      ...job,
      progress_actual: 100,
      status: 'SELESAI',
    };

    const archivedItem: ArchivedJobItem = {
      ...finishedJob,
      archivedAt: new Date().toISOString(),
      archiveType: 'FINISH',
    };

    const updatedFinish = [archivedItem, ...archiveFinish.filter((a) => a.id !== job.id)];
    setArchiveFinish(updatedFinish);
    setLastFinishedJob(job);

    const updatedJobs = jobs.filter((j) => j.id !== job.id);
    setJobs(updatedJobs);

    // Simpan secara ATOMIK dalam 1 transaksi ke server (tidak ada race condition)
    apiSaveJobFinish(
      updatedJobs,
      updatedFinish,
      archiveDeleted,
      `Pekerjaan "${job.deskripsi}" selesai & diarsipkan`
    ).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        setSyncStatus('connected');
      } else {
        setSyncStatus('offline');
        setToastMessage(res.message || 'Gagal menyimpan status Finish ke server.');
      }
    });

    setToastMessage(`Pekerjaan "${job.deskripsi}" telah FINISH dan tersimpan di Arsip Selesai.`);
  };

  const handleRestoreFromArchive = (item: ArchivedJobItem) => {
    if (isGuest) return;
    const { archivedAt, archiveType, deleteReason, ...restoredJob } = item;

    let updatedFinish = archiveFinish;
    let updatedDeleted = archiveDeleted;

    if (archiveType === 'FINISH') {
      updatedFinish = archiveFinish.filter((a) => a.id !== item.id);
      setArchiveFinish(updatedFinish);
    } else {
      updatedDeleted = archiveDeleted.filter((a) => a.id !== item.id);
      setArchiveDeleted(updatedDeleted);
    }

    // Tambahkan kembali ke jobs
    const updatedList = [restoredJob as JobItem, ...jobs.filter((j) => j.id !== item.id)];
    const recalculated = applyCalculations(updatedList, currentDateText);
    setJobs(recalculated);

    // Simpan secara ATOMIK dalam 1 transaksi ke server
    apiSaveJobRestore(
      recalculated,
      updatedFinish,
      updatedDeleted,
      `Pekerjaan "${item.deskripsi}" dipulihkan ke dashboard`
    ).then((res) => {
      if (res.success) {
        if (res.version) serverVersionRef.current = res.version;
        setSyncStatus('connected');
      } else {
        setSyncStatus('offline');
        setToastMessage(res.message || 'Gagal memulihkan data di server.');
      }
    });

    setToastMessage(`Pekerjaan "${item.deskripsi}" berhasil dipulihkan ke dashboard aktif.`);
  };

  const handlePermanentDeleteFromArchive = (item: ArchivedJobItem) => {
    if (isGuest) return;
    let updatedFinish = archiveFinish;
    let updatedDeleted = archiveDeleted;

    if (item.archiveType === 'FINISH') {
      updatedFinish = archiveFinish.filter((a) => a.id !== item.id);
      setArchiveFinish(updatedFinish);
    } else {
      updatedDeleted = archiveDeleted.filter((a) => a.id !== item.id);
      setArchiveDeleted(updatedDeleted);
    }
    apiSaveArchive(updatedFinish, updatedDeleted, `Pekerjaan "${item.deskripsi}" dihapus permanen`).then((res) => {
      if (res.success && res.version) {
        serverVersionRef.current = res.version;
      } else if (!res.success) {
        setSyncStatus('offline');
        setToastMessage(res.message || 'Gagal menghapus permanen di server.');
      }
    });
    setToastMessage(`Pekerjaan "${item.deskripsi}" dihapus permanen dari arsip.`);
  };

  const handleOpenArchiveModal = (tab: 'finish' | 'deleted' = 'finish') => {
    setArchiveModalInitialTab(tab);
    setIsArchiveModalOpen(true);
  };

  const handleUndoFinish = () => {
    if (!lastFinishedJob) return;
    const restored = lastFinishedJob;
    const updatedJobs = [restored, ...jobs];
    const recalculated = applyCalculations(updatedJobs, currentDateText);
    const updatedFinish = archiveFinish.filter((a) => a.id !== restored.id);
    setJobs(recalculated);
    setArchiveFinish(updatedFinish);
    setLastFinishedJob(null);

    apiSaveJobRestore(
      recalculated,
      updatedFinish,
      archiveDeleted,
      `Pekerjaan "${restored.deskripsi}" dikembalikan`
    ).then((res) => {
      if (res.success && res.version) serverVersionRef.current = res.version;
    });
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
    apiSaveJobs(calculated, 'Impor data pekerjaan dari Excel').then((res) => {
      if (res.success && res.version) {
        serverVersionRef.current = res.version;
      } else if (!res.success) {
        setSyncStatus('offline');
        setToastMessage(res.message || 'Gagal menyimpan impor Excel ke server.');
      }
    });
    setToastMessage(`${calculated.length} data pekerjaan berhasil dimuat & disinkronkan.`);
  };

  /**
   * REFRESH DATA (AMAN & TIDAK MENGHAPUS DATA):
   * Mengambil data terbaru dari server dan menyinkronkan seluruh kalkulasi tanpa pernah menghapus arsip.
   */
  const handleRefreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const serverRes = await apiFetchState();
      if (serverRes && serverRes.data) {
        serverVersionRef.current = serverRes.version;
        setConnectedClients(serverRes.clientCount || 1);
        setSyncStatus('connected');
        const sData = serverRes.data;
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
        } catch {}

        if (Array.isArray(sData.jobs)) {
          setJobs(recalculateJobsSchedule(sData.jobs, effectiveDate));
        }

        const isServerAuthoritative = (serverRes.version || 1) > 1;
        const serverFinish = Array.isArray(sData.archiveFinish) ? sData.archiveFinish : [];
        const serverDeleted = Array.isArray(sData.archiveDeleted) ? sData.archiveDeleted : [];

        if (isServerAuthoritative || isGuest) {
          setArchiveFinish(serverFinish);
          setArchiveDeleted(serverDeleted);
        } else {
          // Gunakan penggabungan cerdas hanya jika server masih di state awal (v1)
          setArchiveFinish((prevFinish) => {
            const merged = mergeArchives(prevFinish, serverFinish);
            if (merged.length > serverFinish.length) {
              apiSaveArchive(merged, serverDeleted, 'Sinkronisasi arsip dari cache perangkat');
            }
            return merged;
          });

          setArchiveDeleted((prevDeleted) => {
            const merged = mergeArchives(prevDeleted, serverDeleted);
            if (merged.length > serverDeleted.length) {
              apiSaveArchive(serverFinish, merged, 'Sinkronisasi arsip dari cache perangkat');
            }
            return merged;
          });
        }

        if (typeof sData.pinCode === 'string' && sData.pinCode) {
          setPinCode(sData.pinCode);
          try {
            localStorage.setItem('welding_shop_pincode', sData.pinCode);
          } catch {}
        }
        if (sData.branding) setBranding(sData.branding);
        setToastMessage(
          serverRes.supportsSSE === false
            ? 'Data berhasil disegarkan dari database cloud.'
            : `Sinkronisasi server aktif (${serverRes.clientCount} perangkat terhubung).`
        );
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 450);
    }
  }, [currentDateText, isAutoDate, isGuest]);

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
            apiSaveJobs(calculated, 'Pemulihan data cadangan');
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
   * KONFIRMASI RESET / KOSONGKAN DAFTAR PEKERJAAN:
   * Menyimpan cadangan data saat ini terlebih dahulu, lalu mengosongkan daftar pekerjaan aktif.
   */
  const handleConfirmReset = useCallback(async () => {
    if (isGuest) return;
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
    try {
      localStorage.setItem('welding_shop_jobs_v3', JSON.stringify([]));
      localStorage.setItem('welding_shop_date_v3', ref);
      localStorage.setItem('welding_shop_is_auto_date', 'true');
    } catch {
      // ignore
    }

    const res = await apiResetServer();
    if (res.success && res.version) {
      serverVersionRef.current = res.version;
    }
    setToastMessage(
      'Daftar pekerjaan aktif berhasil dikosongkan dan disinkronkan ke seluruh perangkat.'
    );
  }, [isGuest, jobs]);

  const handleToggleAutoCycle = () => {
    setAutoCycle((prev) => !prev);
  };

  return (
    <div
      id="welding-shop-tv-dashboard"
      className="h-screen h-[100dvh] max-h-screen max-h-[100dvh] w-screen max-w-full overflow-hidden bg-[#EFF3F8] flex flex-col select-none antialiased text-slate-900 relative"
    >
      {/* Toast Notification Floating Banner */}
      {toastMessage && (
        <div
          id="toast-notification-banner"
          className="absolute top-[74px] right-4 z-50 flex items-center gap-2.5 bg-[#032F73] text-white px-4 py-2.5 rounded-xl shadow-[0_12px_32px_-8px_rgba(3,47,115,0.45)] ring-1 ring-white/15 animate-in slide-in-from-top-2 duration-150 max-w-lg"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold leading-snug flex-1">{toastMessage}</span>
          {lastFinishedJob && (
            <button
              onClick={handleUndoFinish}
              className="ml-2 text-xs font-bold text-[#EA7A2D] hover:text-orange-200 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
            >
              Urungkan
            </button>
          )}
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-white/10 rounded-md text-blue-200 hover:text-white transition-colors ml-1"
            aria-label="Tutup notifikasi"
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
        onOpenArchiveModal={handleOpenArchiveModal}
        archiveFinishCount={archiveFinish.length}
        archiveDeletedCount={archiveDeleted.length}
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
          finishedThisMonthCount={sidebarSummary.finishedThisMonthCount}
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
          onDeleteJob={isGuest ? undefined : handleDeleteJob}
          onFinishJob={isGuest ? undefined : handleRequestFinish}
          itemsPerPage={7}
        />
      </main>

      {/* Modals for SheetJS Excel, Job Management, Image Customization, and Reset Confirmation */}
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
        onDeleteJob={handleDeleteJob}
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

      {/* Modal Arsip Data (Selesai dan Dihapus dipisahkan) */}
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
