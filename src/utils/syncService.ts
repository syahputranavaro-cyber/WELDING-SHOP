import { BrandingImages, JobItem, ServerSyncState, ArchivedJobItem } from '../types';

export interface LiteStateData {
  version: number;
  jobs: JobItem[];
  currentDateText: string;
  isAutoDate: boolean;
  updatedAt: string;
  brandingUpdatedAt: string | null;
  archiveFinishCount: number;
  archiveDeletedCount: number;
}

export interface ApiWriteResult {
  success: boolean;
  status?: number;
  version?: number;
  jobs?: JobItem[];
  brandingUpdatedAt?: string | null;
  branding?: BrandingImages;
  message?: string;
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

export async function apiFetchVersion(): Promise<{
  success: boolean;
  version: number;
  brandingUpdatedAt?: string | null;
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

export async function apiFetchLiteState(): Promise<{
  success: boolean;
  version: number;
  clientCount: number;
  supportsSSE?: boolean;
  storage?: string;
  data: LiteStateData;
} | null> {
  try {
    const res = await fetch('/api/state/lite', {
      cache: 'no-store',
      headers: await getAuthHeaders({ Accept: 'application/json' }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Gagal fetch /api/state/lite:', err);
    return null;
  }
}

export async function apiFetchBranding(): Promise<{
  success: boolean;
  version: number;
  brandingUpdatedAt?: string | null;
  branding: BrandingImages;
} | null> {
  try {
    const res = await fetch('/api/branding', {
      cache: 'no-store',
      headers: await getAuthHeaders({ Accept: 'application/json' }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Gagal fetch /api/branding:', err);
    return null;
  }
}

export async function apiFetchArchives(): Promise<{
  success: boolean;
  version: number;
  archiveFinish: ArchivedJobItem[];
  archiveDeleted: ArchivedJobItem[];
} | null> {
  try {
    const res = await fetch('/api/archives', {
      cache: 'no-store',
      headers: await getAuthHeaders({ Accept: 'application/json' }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Gagal fetch /api/archives:', err);
    return null;
  }
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

/**
 * Multi-Admin Safe: Menyimpan/memperbarui 1 pekerjaan saja (Tambah, Edit, atau Edit Cepat Actual)
 */
export async function apiUpsertSingleJob(
  job: JobItem,
  actionDescription?: string
): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/jobs/upsert', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ job, actionDescription }),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return { success: true, status: res.status, version: json.version, jobs: json.jobs };
  } catch (err) {
    console.error('Gagal menyimpan pekerjaan:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

/**
 * Bulk replace jobs (Impor Excel / Pemulihan cadangan)
 */
export async function apiSaveJobs(
  jobs: JobItem[],
  actionDescription?: string
): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ jobs, actionDescription }),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return { success: true, status: res.status, version: json.version, jobs: json.jobs };
  } catch (err) {
    console.error('Gagal menyimpan jobs:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSaveBranding(
  branding: Partial<BrandingImages>
): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/branding', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ branding }),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return {
      success: true,
      status: res.status,
      version: json.version,
      brandingUpdatedAt: json.brandingUpdatedAt,
      branding: json.branding,
    };
  } catch (err) {
    console.error('Gagal menyimpan branding:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiSaveDate(
  currentDateText: string,
  isAutoDate: boolean
): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/date', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ currentDateText, isAutoDate }),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return { success: true, status: res.status, version: json.version };
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
  currentDateText?: string;
  isAutoDate?: boolean;
}): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return { success: true, status: res.status, version: json.version };
  } catch (err) {
    console.error('Gagal menyimpan data lengkap:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

/**
 * Multi-Admin Safe: Finish 1 pekerjaan -> arsipkan tanpa menimpa editan Admin lain
 */
export async function apiFinishSingleJob(
  job: ArchivedJobItem,
  actionDescription?: string
): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/jobs/finish', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ job, actionDescription }),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return { success: true, status: res.status, version: json.version, jobs: json.jobs };
  } catch (err) {
    console.error('Gagal menyimpan finish job:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

/**
 * Multi-Admin Safe: Hapus 1 pekerjaan -> pindahkan ke Arsip Dihapus
 */
export async function apiDeleteSingleJob(
  job: ArchivedJobItem,
  deleteReason?: string,
  actionDescription?: string
): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/jobs/delete', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ job, deleteReason, actionDescription }),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return { success: true, status: res.status, version: json.version, jobs: json.jobs };
  } catch (err) {
    console.error('Gagal menyimpan delete job:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

/**
 * Multi-Admin Safe: Pulihkan 1 pekerjaan dari arsip
 */
export async function apiRestoreSingleJob(
  item: ArchivedJobItem,
  archiveType: 'FINISH' | 'DELETED',
  actionDescription?: string
): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/jobs/restore', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ item, archiveType, actionDescription }),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return { success: true, status: res.status, version: json.version, jobs: json.jobs };
  } catch (err) {
    console.error('Gagal memulihkan job:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

/**
 * Multi-Admin Safe: Hapus permanen 1 item arsip
 */
export async function apiDeleteSingleArchive(
  id: number,
  archiveType: 'FINISH' | 'DELETED',
  actionDescription?: string
): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/archive/delete', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, archiveType, actionDescription }),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return { success: true, status: res.status, version: json.version };
  } catch (err) {
    console.error('Gagal menghapus arsip permanen:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}

export async function apiResetServer(): Promise<ApiWriteResult> {
  try {
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!res.ok) {
      return { success: false, status: res.status, message: await extractErrorMessage(res) };
    }
    const json = await res.json();
    return { success: true, status: res.status, version: json.version };
  } catch (err) {
    console.error('Gagal reset data:', err);
    return { success: false, message: 'Gagal menghubungi server.' };
  }
}
