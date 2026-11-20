import { BrandingImages, JobItem, ServerSyncState, ArchivedJobItem } from '../types';

export interface SyncEventPayload {
  type: 'SYNC' | 'UPDATE' | 'UPDATE_JOBS' | 'UPDATE_BRANDING' | 'UPDATE_DATE' | 'UPDATE_STATE' | 'UPDATE_ARCHIVE' | 'UPDATE_PIN' | 'RESET' | 'CLIENT_COUNT';
  action?: string;
  version: number;
  clientCount?: number;
  updatedAt?: string;
  data?: ServerSyncState;
}

/**
 * Mengambil state lengkap dari server
 */
export async function apiFetchState(): Promise<{
  success: boolean;
  version: number;
  clientCount: number;
  data: ServerSyncState;
} | null> {
  try {
    const res = await fetch('/api/state', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Gagal fetch /api/state:', err);
    return null;
  }
}

/**
 * Pengecekan versi server yang sangat ringan untuk fallback polling
 */
export async function apiFetchVersion(): Promise<{
  success: boolean;
  version: number;
  clientCount: number;
  updatedAt: string;
} | null> {
  try {
    const res = await fetch('/api/state/version', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Menyimpan daftar pekerjaan (Jobs) ke server
 */
export async function apiSaveJobs(
  jobs: JobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number }> {
  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, actionDescription }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan jobs ke server:', err);
    return { success: false };
  }
}

/**
 * Menyimpan logo & poster branding ke server
 */
export async function apiSaveBranding(
  branding: BrandingImages
): Promise<{ success: boolean; version?: number }> {
  try {
    const res = await fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branding }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan branding ke server:', err);
    return { success: false };
  }
}

/**
 * Menyimpan tanggal acuan dashboard ke server
 */
export async function apiSaveDate(
  currentDateText: string,
  isAutoDate: boolean
): Promise<{ success: boolean; version?: number }> {
  try {
    const res = await fetch('/api/date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentDateText, isAutoDate }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan date ke server:', err);
    return { success: false };
  }
}

/**
 * Menyimpan state lengkap (misal import JSON) ke server
 */
export async function apiSaveFullState(payload: {
  jobs?: JobItem[];
  archiveFinish?: ArchivedJobItem[];
  archiveDeleted?: ArchivedJobItem[];
  branding?: BrandingImages;
  pinCode?: string;
  currentDateText?: string;
  isAutoDate?: boolean;
}): Promise<{ success: boolean; version?: number; data?: ServerSyncState }> {
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version, data: json.data };
  } catch (err) {
    console.error('Gagal menyimpan full state ke server:', err);
    return { success: false };
  }
}

/**
 * Operasi Atomik 1: Menyelesaikan pekerjaan (Finish) dan menyimpan arsip dalam 1 payload terkoordinasi
 */
export async function apiSaveJobFinish(
  jobs: JobItem[],
  archiveFinish: ArchivedJobItem[],
  archiveDeleted: ArchivedJobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number; data?: ServerSyncState }> {
  try {
    const res = await fetch('/api/jobs/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, archiveFinish, archiveDeleted, actionDescription }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version, data: json.data };
  } catch (err) {
    console.error('Gagal menyimpan finish job ke server:', err);
    return { success: false };
  }
}

/**
 * Operasi Atomik 2: Menghapus pekerjaan dan memindahkan ke arsip dihapus dalam 1 payload terkoordinasi
 */
export async function apiSaveJobDelete(
  jobs: JobItem[],
  archiveDeleted: ArchivedJobItem[],
  archiveFinish: ArchivedJobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number; data?: ServerSyncState }> {
  try {
    const res = await fetch('/api/jobs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, archiveDeleted, archiveFinish, actionDescription }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version, data: json.data };
  } catch (err) {
    console.error('Gagal menyimpan delete job ke server:', err);
    return { success: false };
  }
}

/**
 * Operasi Atomik 3: Memulihkan pekerjaan dari arsip kembali ke daftar aktif dalam 1 payload terkoordinasi
 */
export async function apiSaveJobRestore(
  jobs: JobItem[],
  archiveFinish: ArchivedJobItem[],
  archiveDeleted: ArchivedJobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number; data?: ServerSyncState }> {
  try {
    const res = await fetch('/api/jobs/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, archiveFinish, archiveDeleted, actionDescription }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version, data: json.data };
  } catch (err) {
    console.error('Gagal menyimpan restore job ke server:', err);
    return { success: false };
  }
}

/**
 * Menyimpan data arsip (finish dan deleted) ke server
 */
export async function apiSaveArchive(
  archiveFinish: ArchivedJobItem[],
  archiveDeleted: ArchivedJobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number }> {
  try {
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archiveFinish, archiveDeleted, actionDescription }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan arsip ke server:', err);
    return { success: false };
  }
}

/**
 * Menyimpan atau memperbarui PIN keamanan ke server
 */
export async function apiSavePin(
  pinCode: string
): Promise<{ success: boolean; version?: number }> {
  try {
    const res = await fetch('/api/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinCode }),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan PIN ke server:', err);
    return { success: false };
  }
}

/**
 * Reset data di server ke default
 */
export async function apiResetServer(): Promise<{ success: boolean; version?: number }> {
  try {
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal reset server:', err);
    return { success: false };
  }
}
