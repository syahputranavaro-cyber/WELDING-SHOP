/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { JobItem, BrandingImages, SyncStatusType, ArchivedJobItem } from './types';
import { INITIAL_JOBS } from './data/initialJobs';
import { HeaderBanner } from './components/HeaderBanner';
import { SidebarSafety } from './components/SidebarSafety';
import { JobsTable } from './components/JobsTable';
import { ExcelManagerModal } from './components/ExcelManagerModal';
import { JobEditorModal } from './components/JobEditorModal';
import { ImageUploadModal } from './components/ImageUploadModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { FinishConfirmModal } from './components/FinishConfirmModal';
import { PinModal } from './components/PinModal';
import { ArchiveModal } from './components/ArchiveModal';
import { calculateJobTarget, getSystemDateFormatted } from './utils/jobCalculations';
import {
  apiFetchState,
  apiFetchVersion,
  apiSaveJobs,
  apiSaveBranding,
  apiSaveDate,
  apiSaveFullState,
  apiResetServer,
  apiSaveArchive,
  apiSavePin,
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

  const [isSessionAuthenticated, setIsSessionAuthenticated] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinPendingAction, setPinPendingAction] = useState<{
    callback: () => void;
    description: string;
  } | null>(null);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [archiveModalInitialTab, setArchiveModalInitialTab] = useState<'finish' | 'deleted'>('finish');

  // Helper untuk meminta otorisasi PIN sebelum mengeksekusi tindakan sensitif
  const requestPinProtectedAction = useCallback(
    (action: () => void, description: string) => {
      if (isSessionAuthenticated) {
        action();
        return;
      }
      setPinPendingAction({ callback: action, description });
      setIsPinModalOpen(true);
    },
    [isSessionAuthenticated]
  );

  const handlePinSuccess = useCallback(() => {
    setIsPinModalOpen(false);
    if (pinPendingAction) {
      const pending = pinPendingAction.callback;
      setPinPendingAction(null);
      pending();
    }
  }, [pinPendingAction]);

  const handleSessionAuthToggle = useCallback((remember: boolean) => {
    if (remember) {
      setIsSessionAuthenticated(true);
    }
  }, []);

  // Recalculate target progress whenever the dashboard reference date changes (manual or automatic)
  const handleUpdateDate = useCallback(
    (newDate: string, isManual: boolean = true) => {
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
      apiSaveDate(newDate, !isManual);
      if (isManual) {
        setToastMessage(`Mode Simulasi: Tanggal diatur ke ${newDate}. Disinkronkan ke seluruh perangkat.`);
      } else {
        setToastMessage(`Mode Otomatis Aktif: Mengikuti tanggal sistem real-time (${newDate}).`);
      }
    },
    []
  );

  // Reset tanggal ke otomatis sistem real-time
  const handleResetToAutoDate = useCallback(() => {
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
    apiSaveDate(today, true);
    setToastMessage(`Kembali ke tanggal sistem otomatis: ${today}. Disinkronkan ke seluruh perangkat.`);
  }, []);

  // Pengecekan otomatis pergantian hari real-time (setiap 30 detik)
  // Ketika jam melewati tengah malam (00:00), tanggal "HARI INI" dan grafik SCHEDULE seluruh job otomatis bertambah/ter-update
  useEffect(() => {
    if (!isAutoDate) return;

    const checkMidnightTransition = () => {
      const systemToday = getSystemDateFormatted();
      if (systemToday !== currentDateText) {
        setCurrentDateText(systemToday);
        setJobs((prevJobs) => recalculateJobsSchedule(prevJobs, systemToday));
        setToastMessage(
          `Pergantian hari terdeteksi: Tanggal sistem otomatis diperbarui ke ${systemToday}. Schedule diperbarui.`
        );
      }
    };

    const interval = setInterval(checkMidnightTransition, 30000);
    return () => clearInterval(interval);
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

  // Handler untuk menyimpan / menyinkronkan seluruh data secara paksa
  const handleForceSyncServer = useCallback(async () => {
    setSyncStatus('saving');
    const res = await apiSaveFullState({
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
      setToastMessage('Gagal menghubungi server. Periksa koneksi jaringan.');
    }
  }, [jobs, archiveFinish, archiveDeleted, branding, pinCode, currentDateText, isAutoDate]);

  // Real-Time Multi-Device Synchronization Engine (SSE + Polling Fallback)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    // 1. Ambil data awal dari server saat perangkat pertama kali terhubung
    async function loadInitialState() {
      try {
        const res = await apiFetchState();
        if (!isMounted || !res || !res.data) return;

        serverVersionRef.current = res.version || 1;
        setConnectedClients(res.clientCount || 1);
        setSyncStatus('connected');

        const serverData = res.data;
        const isServerAuthoritative = (res.version || 1) > 1;
        if (Array.isArray(serverData.jobs) && (serverData.jobs.length > 0 || isServerAuthoritative)) {
          const activeDate = serverData.currentDateText || currentDateText;
          setJobs(recalculateJobsSchedule(serverData.jobs, activeDate));
          try {
            localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(serverData.jobs));
          } catch {}
        }
        const serverFinish = Array.isArray(serverData.archiveFinish) ? serverData.archiveFinish : [];
        const serverDeleted = Array.isArray(serverData.archiveDeleted) ? serverData.archiveDeleted : [];

        if (isServerAuthoritative) {
          setArchiveFinish(serverFinish);
          setArchiveDeleted(serverDeleted);
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
        if (typeof serverData.isAutoDate === 'boolean') {
          setIsAutoDate(serverData.isAutoDate);
        }
        if (typeof serverData.currentDateText === 'string') {
          setCurrentDateText(serverData.currentDateText);
        }
      } catch (err) {
        console.warn('Gagal memuat state awal:', err);
      }
    }

    loadInitialState();

    // 2. Hubungkan ke Server-Sent Events (SSE) untuk push update seketika (< 100ms)
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
                const data = payload.data;
                if (!data) return;

                if (Array.isArray(data.jobs)) {
                  const activeDate = data.currentDateText || currentDateText;
                  setJobs(recalculateJobsSchedule(data.jobs, activeDate));
                  try {
                    localStorage.setItem('welding_shop_jobs_v3', JSON.stringify(data.jobs));
                  } catch {}
                }
                if (Array.isArray(data.archiveFinish)) {
                  setArchiveFinish(data.archiveFinish);
                }
                if (Array.isArray(data.archiveDeleted)) {
                  setArchiveDeleted(data.archiveDeleted);
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
                if (typeof data.isAutoDate === 'boolean') {
                  setIsAutoDate(data.isAutoDate);
                }
                if (typeof data.currentDateText === 'string') {
                  setCurrentDateText(data.currentDateText);
                }

                if (payload.action) {
                  setToastMessage(`⚡ Terupdate dari perangkat lain: ${payload.action}`);
                }
              }
            }
          } catch (e) {
            console.error('Error parsing SSE event:', e);
          }
        };

        eventSource.onerror = () => {
          if (isMounted) setSyncStatus('offline');
          // Browser EventSource otomatis reconnect di background
        };
      } catch (e) {
        console.warn('EventSource tidak dapat diinisialisasi:', e);
      }
    }

    setupSSE();

    // 3. Fallback Polling Ringan setiap 4 detik untuk memeriksa jika ada versi baru di server
    pollInterval = setInterval(async () => {
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
            const data = fullRes.data;
            if (Array.isArray(data.jobs)) {
              const activeDate = data.currentDateText || currentDateText;
              setJobs(recalculateJobsSchedule(data.jobs, activeDate));
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
            if (typeof data.isAutoDate === 'boolean') setIsAutoDate(data.isAutoDate);
            if (typeof data.currentDateText === 'string') setCurrentDateText(data.currentDateText);
            setToastMessage('⚡ Data diperbarui otomatis dari server.');
          }
        }
      } catch {
        if (isMounted) setSyncStatus('offline');
      }
    }, 4000);

    return () => {
      isMounted = false;
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

      apiSaveFullState({
        jobs: nextJobs,
        archiveFinish: nextFinish,
        archiveDeleted: nextDeleted,
        branding: nextBranding,
        pinCode: nextPin,
        currentDateText: resolvedDateText,
        isAutoDate: resolvedIsAutoDate,
      }).then((res) => {
        if (res.success && res.version) {
          serverVersionRef.current = res.version;
        }
      });

      setToastMessage(
        `Berhasil memulihkan ${nextJobs.length} pekerjaan & ${nextFinish.length + nextDeleted.length} arsip ke server!`
      );
    },
    [currentDateText, jobs, archiveFinish, archiveDeleted, branding, pinCode, isAutoDate]
  );

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
    apiSaveBranding(updated);
    setToastMessage('Branding berhasil disimpan & disinkronkan ke semua perangkat.');
  };

  const handleOpenAddJob = () => {
    requestPinProtectedAction(() => {
      setJobToEdit(null);
      setIsJobEditorOpen(true);
    }, 'Menambah Job Baru');
  };

  const handleOpenEditJob = (job: JobItem) => {
    requestPinProtectedAction(() => {
      setJobToEdit(job);
      setIsJobEditorOpen(true);
    }, `Mengedit Job: ${job.deskripsi}`);
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
      apiSaveJobs(recalculated, `Pekerjaan "${job.deskripsi}" disimpan`);
      return recalculated;
    });

    setToastMessage(`Pekerjaan "${job.deskripsi}" berhasil disimpan & disinkronkan.`);
  };

  const handleDeleteJob = (id: number) => {
    const job = jobs.find((j) => j.id === id);
    const desc = job ? job.deskripsi : `Pekerjaan #${id}`;

    requestPinProtectedAction(() => {
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
      );

      setToastMessage(`Pekerjaan "${desc}" dihapus & tersimpan aman di Arsip Dihapus.`);
    }, `Menghapus Job: ${desc}`);
  };

  const handleRequestFinish = (job: JobItem) => {
    requestPinProtectedAction(() => {
      setJobToFinish(job);
    }, `Menyelesaikan (Finish) Job: ${job.deskripsi}`);
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
    );

    setToastMessage(`Pekerjaan "${job.deskripsi}" telah FINISH dan tersimpan di Arsip Selesai.`);
  };

  const handleRestoreFromArchive = (item: ArchivedJobItem) => {
    requestPinProtectedAction(() => {
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
      );

      setToastMessage(`Pekerjaan "${item.deskripsi}" berhasil dipulihkan ke dashboard aktif.`);
    }, `Memulihkan Pekerjaan: ${item.deskripsi}`);
  };

  const handlePermanentDeleteFromArchive = (item: ArchivedJobItem) => {
    requestPinProtectedAction(() => {
      let updatedFinish = archiveFinish;
      let updatedDeleted = archiveDeleted;

      if (item.archiveType === 'FINISH') {
        updatedFinish = archiveFinish.filter((a) => a.id !== item.id);
        setArchiveFinish(updatedFinish);
      } else {
        updatedDeleted = archiveDeleted.filter((a) => a.id !== item.id);
        setArchiveDeleted(updatedDeleted);
      }
      apiSaveArchive(updatedFinish, updatedDeleted, `Pekerjaan "${item.deskripsi}" dihapus permanen`);
      setToastMessage(`Pekerjaan "${item.deskripsi}" dihapus permanen dari arsip.`);
    }, `Menghapus Permanen Pekerjaan: ${item.deskripsi}`);
  };

  const handleSavePin = (newPin: string) => {
    setPinCode(newPin);
    try {
      localStorage.setItem('welding_shop_pincode', newPin);
    } catch {}
    apiSavePin(newPin);
    setToastMessage('PIN Keamanan baru berhasil disimpan & disinkronkan ke server.');
  };

  const handleOpenArchiveModal = (tab: 'finish' | 'deleted' = 'finish') => {
    setArchiveModalInitialTab(tab);
    setIsArchiveModalOpen(true);
  };

  const handleOpenPinSettings = () => {
    setPinPendingAction(null);
    setIsPinModalOpen(true);
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
    );
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
    apiSaveJobs(calculated, 'Impor data pekerjaan dari Excel');
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
        const activeDate = sData.currentDateText || currentDateText;
        if (Array.isArray(sData.jobs)) {
          setJobs(recalculateJobsSchedule(sData.jobs, activeDate));
        }

        const isServerAuthoritative = (serverRes.version || 1) > 1;
        const serverFinish = Array.isArray(sData.archiveFinish) ? sData.archiveFinish : [];
        const serverDeleted = Array.isArray(sData.archiveDeleted) ? sData.archiveDeleted : [];

        if (isServerAuthoritative) {
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
        if (typeof sData.isAutoDate === 'boolean') setIsAutoDate(sData.isAutoDate);
        if (typeof sData.currentDateText === 'string') setCurrentDateText(sData.currentDateText);
        setToastMessage(`Sinkronisasi server aktif (${serverRes.clientCount} perangkat terhubung).`);
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 450);
    }
  }, [currentDateText]);

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
   * KONFIRMASI RESET DATA KE DEFAULT:
   * Menyimpan cadangan data saat ini terlebih dahulu, lalu mereset ke 3 pekerjaan awal.
   */
  const handleConfirmReset = useCallback(async () => {
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

    await apiResetServer();
    setToastMessage(
      'Data direset ke default pabrik dan disinkronkan ke seluruh perangkat. Cadangan tersimpan aman.'
    );
  }, [applyCalculations, jobs]);

  const handleToggleAutoCycle = () => {
    setAutoCycle((prev) => !prev);
  };

  return (
    <div
      id="welding-shop-tv-dashboard"
      className="h-screen h-[100dvh] max-h-screen max-h-[100dvh] w-screen max-w-full overflow-hidden bg-[#F8FAFC] flex flex-col font-sans select-none antialiased text-slate-900 relative"
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
        syncStatus={syncStatus}
        connectedClients={connectedClients}
        onForceSyncServer={handleForceSyncServer}
        onOpenArchiveModal={handleOpenArchiveModal}
        onOpenPinSettings={handleOpenPinSettings}
        archiveFinishCount={archiveFinish.length}
        archiveDeletedCount={archiveDeleted.length}
      />

      {/* Body: Sidebar Kiri (Panel Informasi & K3) + Area Konten Utama (Tabel Jobs) */}
      <main className="flex-1 min-h-0 flex flex-row overflow-hidden relative w-full">
        {/* B. Sidebar Kiri (Panel Informasi & K3) */}
        <SidebarSafety
          activeJobsCount={activeJobsCount}
          completedJobsCount={completedJobsCount}
          totalJobsCount={jobs.length}
          currentDateText={currentDateText}
          isAutoDate={isAutoDate}
          onUpdateDateText={handleUpdateDate}
          onResetToAutoDate={handleResetToAutoDate}
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
          itemsPerPage={7}
        />
      </main>

      {/* Modals for SheetJS Excel, Job Management, Image Customization, and Reset Confirmation */}
      <ExcelManagerModal
        isOpen={isExcelModalOpen}
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

      {/* Modal PIN Keamanan (Proteksi Tambah, Edit, Hapus, Pulihkan) */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPinPendingAction(null);
        }}
        onSuccess={handlePinSuccess}
        currentPin={pinCode}
        actionDescription={pinPendingAction?.description || 'Pengaturan PIN Keamanan'}
        onChangePin={handleSavePin}
        onSessionAuthToggle={handleSessionAuthToggle}
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
      />
    </div>
  );
}
