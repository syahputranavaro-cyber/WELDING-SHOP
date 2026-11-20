import { BrandingImages, JobItem, ServerSyncState, ArchivedJobItem } from '../types';

export interface SyncEventPayload {
  type:
    | 'SYNC'
    | 'UPDATE'
    | 'UPDATE_JOBS'
    | 'UPDATE_BRANDING'
    | 'UPDATE_DATE'
    | 'UPDATE_STATE'
    | 'UPDATE_ARCHIVE'
    | 'UPDATE_PIN'
    | 'UPDATE_FINISH_JOB'
    | 'UPDATE_DELETE_JOB'
    | 'UPDATE_RESTORE_JOB'
    | 'RESET'
    | 'CLIENT_COUNT';
  action?: string;
  version: number;
  clientCount?: number;
  updatedAt?: string;
  data?: ServerSyncState;
}

type TokenProvider = () => Promise<string | null>;

let authTokenProvider: TokenProvider | null = null;

export function setAuthTokenProvider(provider: TokenProvider) {
  authTokenProvider = provider;
}

export async function getCurrentAuthToken(): Promise<string | null> {
  if (!authTokenProvider) return null;
  return authTokenProvider();
}

async function getAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = await getCurrentAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function extractErrorMessage(res: Response): Promise<string> {
  if (res.status === 413) {
    return 'Ukuran data/gambar terlalu besar untuk 1 pengiriman. Coba kompres gambar atau ulangi.';
  }
  try {
    const json = await res.json();
    if (json && typeof json.message === 'string' && json.message) {
      return json.message;
    }
  } catch {
    // ignore non-JSON body
  }
  return `Server merespons status ${res.status}`;
}

export async function apiFetchState(): Promise<{
  success: boolean;
  version: number;
  clientCount: number;
  supportsSSE?: boolean;
  storage?: string;
  data: ServerSyncState;
} | null> {
  try {
    const res = await fetch('/api/state', {
      cache: 'no-store',
      headers: await getAuthHeaders({ Accept: 'application/json' }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Gagal fetch /api/state:', err);
    return null;
  }
}

export async function apiFetchVersion(): Promise<{
  success: boolean;
  version: number;
  clientCount: number;
  supportsSSE?: boolean;
  updatedAt: string;
} | null> {
  try {
    const res = await fetch('/api/state/version', {
      cache: 'no-store',
      headers: await getAuthHeaders({ Accept: 'application/json' }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiSaveJobs(
  jobs: JobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number; message?: string }> {
  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ jobs, actionDescription }),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan jobs:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSaveBranding(
  branding: Partial<BrandingImages>
): Promise<{ success: boolean; version?: number; message?: string }> {
  try {
    const res = await fetch('/api/branding', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ branding }),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan branding:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSaveDate(
  currentDateText: string,
  isAutoDate: boolean
): Promise<{ success: boolean; version?: number; message?: string }> {
  try {
    const res = await fetch('/api/date', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ currentDateText, isAutoDate }),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan tanggal:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSaveFullState(payload: {
  jobs?: JobItem[];
  archiveFinish?: ArchivedJobItem[];
  archiveDeleted?: ArchivedJobItem[];
  branding?: Partial<BrandingImages>;
  pinCode?: string;
  currentDateText?: string;
  isAutoDate?: boolean;
}): Promise<{ success: boolean; version?: number; data?: ServerSyncState; message?: string }> {
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version, data: json.data };
  } catch (err) {
    console.error('Gagal menyimpan data lengkap:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSaveJobFinish(
  jobs: JobItem[],
  archiveFinish: ArchivedJobItem[],
  archiveDeleted: ArchivedJobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number; data?: ServerSyncState; message?: string }> {
  try {
    const res = await fetch('/api/jobs/finish', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ jobs, archiveFinish, archiveDeleted, actionDescription }),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version, data: json.data };
  } catch (err) {
    console.error('Gagal menyimpan finish job:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSaveJobDelete(
  jobs: JobItem[],
  archiveDeleted: ArchivedJobItem[],
  archiveFinish: ArchivedJobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number; data?: ServerSyncState; message?: string }> {
  try {
    const res = await fetch('/api/jobs/delete', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ jobs, archiveDeleted, archiveFinish, actionDescription }),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version, data: json.data };
  } catch (err) {
    console.error('Gagal menyimpan delete job:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSaveJobRestore(
  jobs: JobItem[],
  archiveFinish: ArchivedJobItem[],
  archiveDeleted: ArchivedJobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number; data?: ServerSyncState; message?: string }> {
  try {
    const res = await fetch('/api/jobs/restore', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ jobs, archiveFinish, archiveDeleted, actionDescription }),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version, data: json.data };
  } catch (err) {
    console.error('Gagal menyimpan restore job:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSaveArchive(
  archiveFinish: ArchivedJobItem[],
  archiveDeleted: ArchivedJobItem[],
  actionDescription?: string
): Promise<{ success: boolean; version?: number; message?: string }> {
  try {
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ archiveFinish, archiveDeleted, actionDescription }),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan arsip:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSavePin(
  pinCode: string
): Promise<{ success: boolean; version?: number; message?: string }> {
  try {
    const res = await fetch('/api/pin', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ pinCode }),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan PIN:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiResetServer(): Promise<{ success: boolean; version?: number; message?: string }> {
  try {
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!res.ok) return { success: false, message: await extractErrorMessage(res) };
    const json = await res.json();
    return { success: true, version: json.version };
  } catch (err) {
    console.error('Gagal reset data:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}
