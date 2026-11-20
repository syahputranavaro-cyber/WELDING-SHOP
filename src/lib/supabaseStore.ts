import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface BrandingState {
  companyLogoUrl: string | null;
  weldingLogoUrl: string | null;
  k3PosterUrl: string | null;
  useCustomK3Image: boolean;
  updatedAt?: string;
}

export interface PersistedServerState {
  version: number;
  jobs: any[];
  archiveFinish: any[];
  archiveDeleted: any[];
  pinCode: string;
  branding: BrandingState;
  currentDateText: string;
  isAutoDate: boolean;
  updatedAt: string;
}

export interface LiteServerState {
  version: number;
  jobs: any[];
  currentDateText: string;
  isAutoDate: boolean;
  updatedAt: string;
  brandingUpdatedAt: string | null;
  archiveFinishCount: number;
  archiveDeletedCount: number;
}

const DEFAULT_BRANDING: BrandingState = {
  companyLogoUrl: null,
  weldingLogoUrl: null,
  k3PosterUrl: null,
  useCustomK3Image: false,
};

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  let val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1).trim();
  }
  return val.replace(/[\r\n\u200B-\u200D\uFEFF]/g, '');
}

function getSupabaseCredentials(): { url: string; key: string } | null {
  const url = cleanEnvValue(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  ).replace(/\/+$/, '');
  const key = cleanEnvValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_ANON_KEY
  );

  if (!url || !key) return null;
  if (url.includes('your-project-ref') || key.includes('YOUR_SUPABASE_')) return null;

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseCredentials() !== null;
}

function getSupabaseClient(): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  if (!creds) return null;

  const configKey = `${creds.url}::${creds.key.slice(0, 12)}`;
  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = createClient(creds.url, creds.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigKey = configKey;
  }
  return cachedClient;
}

function toSafeNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function toSafeId(val: unknown, fallbackIndex: number): number {
  const n = Math.trunc(Number(val));
  if (Number.isFinite(n) && n > 0) return n;
  return Date.now() + fallbackIndex;
}

function deduplicateById<T extends { id: number }>(items: T[]): T[] {
  const map = new Map<number, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function getTodayIndonesianWita(): string {
  try {
    return new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Makassar',
    });
  } catch {
    return new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}

function mapJobRow(row: any) {
  return {
    id: toSafeNumber(row.id),
    deskripsi: row.deskripsi || '',
    area: row.area || '',
    pic: row.pic || undefined,
    start: row.start_date || '',
    finish: row.finish_date || '',
    progress_target: toSafeNumber(row.progress_target, 0),
    progress_actual: toSafeNumber(row.progress_actual, 0),
    status: row.status || 'I/P',
  };
}

function mapArchiveRow(row: any) {
  return {
    id: toSafeNumber(row.id),
    deskripsi: row.deskripsi || '',
    area: row.area || '',
    pic: row.pic || undefined,
    start: row.start_date || '',
    finish: row.finish_date || '',
    progress_target: toSafeNumber(row.progress_target, 0),
    progress_actual: toSafeNumber(row.progress_actual, 0),
    status: row.status || (row.archive_type === 'FINISH' ? 'SELESAI' : 'I/P'),
    archivedAt: row.archived_at || new Date().toISOString(),
    archiveType: row.archive_type === 'DELETED' ? 'DELETED' : 'FINISH',
    ...(row.delete_reason ? { deleteReason: row.delete_reason } : {}),
  };
}

function normalizeBranding(raw: any): BrandingState {
  if (raw && typeof raw === 'object') {
    return {
      companyLogoUrl: raw.companyLogoUrl ?? null,
      weldingLogoUrl: raw.weldingLogoUrl ?? null,
      k3PosterUrl: raw.k3PosterUrl ?? null,
      useCustomK3Image: Boolean(raw.useCustomK3Image),
      ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {}),
    };
  }
  return { ...DEFAULT_BRANDING };
}

/**
 * Mengecek versi terbaru di Supabase secara sangat ringan (1 row, tanpa kolom gambar)
 */
export async function fetchVersionFromSupabase(): Promise<{
  version: number;
  updatedAt: string;
  brandingUpdatedAt: string | null;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  let res: { data: any; error: any } = await supabase
    .from('welding_settings')
    .select('version, updated_at, branding_updated_at:branding->>updatedAt')
    .eq('id', 'main')
    .maybeSingle();

  if (res.error) {
    res = await supabase
      .from('welding_settings')
      .select('version, updated_at')
      .eq('id', 'main')
      .maybeSingle();
  }

  if (res.error) {
    console.error('[Supabase] Gagal cek versi:', res.error.message);
    return null;
  }

  if (!res.data) return null;
  return {
    version: toSafeNumber(res.data.version, 1),
    updatedAt: res.data.updated_at || new Date().toISOString(),
    brandingUpdatedAt:
      typeof res.data.branding_updated_at === 'string' ? res.data.branding_updated_at : null,
  };
}

/**
 * Memuat state RINGAN untuk layar TV & sinkronisasi rutin:
 * - Hanya mengambil pekerjaan aktif + metadata tanggal/versi + jumlah arsip (head count)
 * - TIDAK mengunduh gambar Base64 branding maupun ratusan baris arsip (hemat >95% bandwidth!)
 */
export async function loadLiteStateFromSupabase(): Promise<LiteServerState | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const [settingsResPrimary, jobsRes, finishCountRes, deletedCountRes] = await Promise.all([
    supabase
      .from('welding_settings')
      .select('version, current_date_text, is_auto_date, updated_at, branding_updated_at:branding->>updatedAt')
      .eq('id', 'main')
      .maybeSingle(),
    supabase
      .from('welding_jobs')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('welding_archives')
      .select('id', { count: 'exact', head: true })
      .eq('archive_type', 'FINISH'),
    supabase
      .from('welding_archives')
      .select('id', { count: 'exact', head: true })
      .eq('archive_type', 'DELETED'),
  ]);

  let settingsData: any = settingsResPrimary.data;
  if (settingsResPrimary.error) {
    const fallbackRes = await supabase
      .from('welding_settings')
      .select('version, current_date_text, is_auto_date, updated_at')
      .eq('id', 'main')
      .maybeSingle();
    if (fallbackRes.error) {
      console.error('[Supabase] Gagal memuat welding_settings (lite):', fallbackRes.error.message);
      return null;
    }
    settingsData = fallbackRes.data;
  }

  if (jobsRes.error) {
    console.error('[Supabase] Gagal memuat welding_jobs (lite):', jobsRes.error.message);
    return null;
  }

  const jobRows = jobsRes.data || [];
  const finishCount = finishCountRes.count ?? 0;
  const deletedCount = deletedCountRes.count ?? 0;

  if (!settingsData && jobRows.length === 0 && finishCount === 0 && deletedCount === 0) {
    return null;
  }

  return {
    version: toSafeNumber(settingsData?.version, 1),
    jobs: jobRows.map(mapJobRow),
    currentDateText: settingsData?.current_date_text || getTodayIndonesianWita(),
    isAutoDate: typeof settingsData?.is_auto_date === 'boolean' ? settingsData.is_auto_date : true,
    updatedAt: settingsData?.updated_at || new Date().toISOString(),
    brandingUpdatedAt:
      typeof settingsData?.branding_updated_at === 'string'
        ? settingsData.branding_updated_at
        : null,
    archiveFinishCount: finishCount,
    archiveDeletedCount: deletedCount,
  };
}

/**
 * Memuat gambar branding (logo perusahaan, logo Welding Shop, poster K3) secara terpisah
 * agar hanya diunduh saat buka awal atau ketika gambar memang berubah.
 */
export async function loadBrandingFromSupabase(): Promise<{
  version: number;
  branding: BrandingState;
  brandingUpdatedAt: string | null;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('welding_settings')
    .select('version, branding')
    .eq('id', 'main')
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Gagal memuat branding:', error.message);
    return null;
  }

  if (!data) return null;
  const branding = normalizeBranding(data.branding);
  return {
    version: toSafeNumber(data.version, 1),
    branding,
    brandingUpdatedAt: branding.updatedAt || null,
  };
}

/**
 * Memuat daftar arsip (FINISH & DELETED) secara on-demand ketika modal Arsip dibuka atau saat ekspor backup.
 */
export async function loadArchivesFromSupabase(): Promise<{
  version: number;
  archiveFinish: any[];
  archiveDeleted: any[];
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const [vInfo, archivesRes] = await Promise.all([
    fetchVersionFromSupabase(),
    supabase
      .from('welding_archives')
      .select('*')
      .order('archived_at', { ascending: false }),
  ]);

  if (archivesRes.error) {
    console.error('[Supabase] Gagal memuat welding_archives:', archivesRes.error.message);
    return null;
  }

  const archiveFinish: any[] = [];
  const archiveDeleted: any[] = [];
  for (const row of archivesRes.data || []) {
    const item = mapArchiveRow(row);
    if (item.archiveType === 'DELETED') {
      archiveDeleted.push(item);
    } else {
      archiveFinish.push(item);
    }
  }

  return {
    version: vInfo?.version ?? 1,
    archiveFinish,
    archiveDeleted,
  };
}

/**
 * Memuat seluruh state aplikasi (jobs, archives, settings) dari Supabase.
 * Mengembalikan null jika Supabase belum dikonfigurasi atau tabel belum memiliki data awal ('main').
 */
export async function loadStateFromSupabase(): Promise<PersistedServerState | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const [settingsRes, jobsRes, archivesRes] = await Promise.all([
    supabase.from('welding_settings').select('*').eq('id', 'main').maybeSingle(),
    supabase
      .from('welding_jobs')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('welding_archives')
      .select('*')
      .order('archived_at', { ascending: false }),
  ]);

  if (settingsRes.error) {
    console.error('[Supabase] Gagal memuat welding_settings:', settingsRes.error.message);
    return null;
  }
  if (jobsRes.error) {
    console.error('[Supabase] Gagal memuat welding_jobs:', jobsRes.error.message);
    return null;
  }
  if (archivesRes.error) {
    console.error('[Supabase] Gagal memuat welding_archives:', archivesRes.error.message);
    return null;
  }

  const hasSettings = Boolean(settingsRes.data);
  const jobRows = jobsRes.data || [];
  const archiveRows = archivesRes.data || [];

  if (!hasSettings && jobRows.length === 0 && archiveRows.length === 0) {
    return null;
  }

  const jobs = jobRows.map(mapJobRow);
  const archiveFinish: any[] = [];
  const archiveDeleted: any[] = [];

  for (const row of archiveRows) {
    const item = mapArchiveRow(row);
    if (item.archiveType === 'DELETED') {
      archiveDeleted.push(item);
    } else {
      archiveFinish.push(item);
    }
  }

  const s = settingsRes.data;
  const branding = normalizeBranding(s?.branding);

  return {
    version: toSafeNumber(s?.version, 1),
    jobs,
    archiveFinish,
    archiveDeleted,
    pinCode: typeof s?.pin_code === 'string' && s.pin_code ? s.pin_code : '1234',
    branding,
    currentDateText: s?.current_date_text || getTodayIndonesianWita(),
    isAutoDate: typeof s?.is_auto_date === 'boolean' ? s.is_auto_date : true,
    updatedAt: s?.updated_at || new Date().toISOString(),
  };
}

/**
 * Memperbarui versi (dan field ringan opsional) pada welding_settings TANPA mengirim ulang kolom gambar branding
 */
export async function bumpSettingsVersionInSupabase(
  updatedAt: string,
  patch?: {
    current_date_text?: string;
    is_auto_date?: boolean;
    branding?: BrandingState;
  }
): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 1;

  const existing = await fetchVersionFromSupabase();
  const nextVersion = Math.max(existing?.version ?? 1, 1) + 1;

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      version: nextVersion,
      updated_at: updatedAt,
    };
    if (patch?.current_date_text !== undefined) {
      updatePayload.current_date_text = patch.current_date_text;
    }
    if (patch?.is_auto_date !== undefined) {
      updatePayload.is_auto_date = patch.is_auto_date;
    }
    if (patch?.branding !== undefined) {
      updatePayload.branding = patch.branding;
    }

    const { error } = await supabase
      .from('welding_settings')
      .update(updatePayload)
      .eq('id', 'main');
    if (error) {
      throw new Error(`Gagal memperbarui welding_settings di Supabase: ${error.message}`);
    }
    return nextVersion;
  }

  // Baris 'main' belum ada -> buat baris awal lengkap
  const { error } = await supabase.from('welding_settings').upsert(
    {
      id: 'main',
      version: nextVersion,
      pin_code: '1234',
      branding: patch?.branding ?? { ...DEFAULT_BRANDING },
      current_date_text: patch?.current_date_text ?? getTodayIndonesianWita(),
      is_auto_date: patch?.is_auto_date ?? true,
      updated_at: updatedAt,
    },
    { onConflict: 'id' }
  );
  if (error) {
    throw new Error(`Gagal membuat welding_settings di Supabase: ${error.message}`);
  }
  return nextVersion;
}

/**
 * Multi-Admin Safe: Menyimpan/memperbarui 1 pekerjaan saja di welding_jobs tanpa menimpa editan Admin lain
 */
export async function upsertSingleJobInSupabase(
  job: any,
  updatedAt: string
): Promise<{ version: number; jobs: any[] }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  const jobId = toSafeId(job.id, 1);

  // Cek apakah job sudah ada agar sort_order dipertahankan; jika job baru, tempatkan di urutan paling atas
  const { data: existingJob } = await supabase
    .from('welding_jobs')
    .select('id, sort_order')
    .eq('id', jobId)
    .maybeSingle();

  let sortOrder = 0;
  if (existingJob && typeof existingJob.sort_order === 'number') {
    sortOrder = existingJob.sort_order;
  } else {
    const { data: minRow } = await supabase
      .from('welding_jobs')
      .select('sort_order')
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    sortOrder =
      minRow && typeof minRow.sort_order === 'number' ? minRow.sort_order - 1 : 0;
  }

  const row = {
    id: jobId,
    deskripsi: String(job.deskripsi || ''),
    area: String(job.area || ''),
    pic: job.pic ? String(job.pic) : null,
    start_date: String(job.start || ''),
    finish_date: String(job.finish || ''),
    progress_target: toSafeNumber(job.progress_target, 0),
    progress_actual: toSafeNumber(job.progress_actual, 0),
    status: String(job.status || 'I/P'),
    sort_order: sortOrder,
    updated_at: updatedAt,
  };

  const { error: upsertErr } = await supabase
    .from('welding_jobs')
    .upsert(row, { onConflict: 'id' });
  if (upsertErr) {
    throw new Error(`Gagal menyimpan pekerjaan ke Supabase: ${upsertErr.message}`);
  }

  const version = await bumpSettingsVersionInSupabase(updatedAt);

  const { data: allRows, error: listErr } = await supabase
    .from('welding_jobs')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (listErr) {
    throw new Error(`Gagal memuat daftar pekerjaan terbaru: ${listErr.message}`);
  }

  return {
    version,
    jobs: (allRows || []).map(mapJobRow),
  };
}

/**
 * Multi-Admin Safe: Menandai 1 pekerjaan selesai (Finish) atau menghapus 1 pekerjaan ke arsip
 * tanpa menimpa pekerjaan lain yang sedang diedit Admin lain.
 */
export async function archiveSingleJobInSupabase(
  job: any,
  archiveType: 'FINISH' | 'DELETED',
  updatedAt: string,
  deleteReason?: string
): Promise<{ version: number; jobs: any[] }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  const jobId = toSafeId(job.id, 1);

  const archiveRow = {
    id: jobId,
    archive_type: archiveType,
    deskripsi: String(job.deskripsi || ''),
    area: String(job.area || ''),
    pic: job.pic ? String(job.pic) : null,
    start_date: String(job.start || ''),
    finish_date: String(job.finish || ''),
    progress_target: toSafeNumber(job.progress_target, 0),
    progress_actual: archiveType === 'FINISH' ? 100 : toSafeNumber(job.progress_actual, 0),
    status: archiveType === 'FINISH' ? 'SELESAI' : String(job.status || 'I/P'),
    archived_at: job.archivedAt || updatedAt,
    delete_reason: archiveType === 'DELETED' ? deleteReason || 'Dihapus dari dashboard' : null,
  };

  const { error: archErr } = await supabase
    .from('welding_archives')
    .upsert(archiveRow, { onConflict: 'id,archive_type' });
  if (archErr) {
    throw new Error(`Gagal mengarsipkan pekerjaan (${archiveType}) ke Supabase: ${archErr.message}`);
  }

  const { error: delErr } = await supabase.from('welding_jobs').delete().eq('id', jobId);
  if (delErr) {
    throw new Error(`Gagal memindahkan pekerjaan dari daftar aktif: ${delErr.message}`);
  }

  const version = await bumpSettingsVersionInSupabase(updatedAt);

  const { data: allRows } = await supabase
    .from('welding_jobs')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  return {
    version,
    jobs: (allRows || []).map(mapJobRow),
  };
}

/**
 * Multi-Admin Safe: Memulihkan 1 pekerjaan dari arsip ke daftar aktif
 */
export async function restoreSingleJobInSupabase(
  item: any,
  archiveType: 'FINISH' | 'DELETED',
  updatedAt: string
): Promise<{ version: number; jobs: any[] }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  const jobId = toSafeId(item.id, 1);

  const restoredStatus =
    String(item.status || '').toUpperCase() === 'HOLD' ? 'HOLD' : 'I/P';

  const { data: minRow } = await supabase
    .from('welding_jobs')
    .select('sort_order')
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  const sortOrder = minRow && typeof minRow.sort_order === 'number' ? minRow.sort_order - 1 : 0;

  const { error: upsertErr } = await supabase.from('welding_jobs').upsert(
    {
      id: jobId,
      deskripsi: String(item.deskripsi || ''),
      area: String(item.area || ''),
      pic: item.pic ? String(item.pic) : null,
      start_date: String(item.start || ''),
      finish_date: String(item.finish || ''),
      progress_target: toSafeNumber(item.progress_target, 0),
      progress_actual: toSafeNumber(item.progress_actual, 0),
      status: restoredStatus,
      sort_order: sortOrder,
      updated_at: updatedAt,
    },
    { onConflict: 'id' }
  );
  if (upsertErr) {
    throw new Error(`Gagal memulihkan pekerjaan ke daftar aktif: ${upsertErr.message}`);
  }

  const { error: delErr } = await supabase
    .from('welding_archives')
    .delete()
    .eq('id', jobId)
    .eq('archive_type', archiveType);
  if (delErr) {
    throw new Error(`Gagal menghapus entri arsip setelah pemulihan: ${delErr.message}`);
  }

  const version = await bumpSettingsVersionInSupabase(updatedAt);

  const { data: allRows } = await supabase
    .from('welding_jobs')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  return {
    version,
    jobs: (allRows || []).map(mapJobRow),
  };
}

/**
 * Multi-Admin Safe: Menghapus 1 entri arsip secara permanen
 */
export async function deleteSingleArchiveInSupabase(
  id: number,
  archiveType: 'FINISH' | 'DELETED',
  updatedAt: string
): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  const { error } = await supabase
    .from('welding_archives')
    .delete()
    .eq('id', toSafeId(id, 1))
    .eq('archive_type', archiveType);
  if (error) {
    throw new Error(`Gagal menghapus arsip permanen di Supabase: ${error.message}`);
  }

  return bumpSettingsVersionInSupabase(updatedAt);
}

/**
 * Menyinkronkan seluruh daftar pekerjaan aktif ke tabel welding_jobs (untuk Impor Excel / Restore Backup / Reset)
 */
export async function syncJobsToSupabase(jobs: any[], updatedAt: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const rows = deduplicateById(
    (jobs || []).map((job, idx) => ({
      id: toSafeId(job.id, idx + 1),
      deskripsi: String(job.deskripsi || ''),
      area: String(job.area || ''),
      pic: job.pic ? String(job.pic) : null,
      start_date: String(job.start || ''),
      finish_date: String(job.finish || ''),
      progress_target: toSafeNumber(job.progress_target, 0),
      progress_actual: toSafeNumber(job.progress_actual, 0),
      status: String(job.status || 'I/P'),
      sort_order: idx,
      updated_at: updatedAt,
    }))
  );

  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('welding_jobs')
      .upsert(rows, { onConflict: 'id' });
    if (upsertErr) {
      throw new Error(`Gagal menyimpan welding_jobs ke Supabase: ${upsertErr.message}`);
    }
  }

  const { data: existingRows, error: fetchErr } = await supabase
    .from('welding_jobs')
    .select('id');

  if (fetchErr) {
    throw new Error(`Gagal memeriksa baris lama welding_jobs: ${fetchErr.message}`);
  }

  const keepIds = new Set(rows.map((r) => r.id));
  const idsToDelete = (existingRows || [])
    .map((r: any) => toSafeNumber(r.id))
    .filter((id) => !keepIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('welding_jobs')
      .delete()
      .in('id', idsToDelete);
    if (delErr) {
      throw new Error(`Gagal menghapus baris usang welding_jobs: ${delErr.message}`);
    }
  }
}

async function syncArchiveBucket(
  supabase: SupabaseClient,
  items: any[],
  archiveType: 'FINISH' | 'DELETED'
): Promise<void> {
  const rows = deduplicateById(
    (items || []).map((item, idx) => ({
      id: toSafeId(item.id, idx + 1),
      archive_type: archiveType,
      deskripsi: String(item.deskripsi || ''),
      area: String(item.area || ''),
      pic: item.pic ? String(item.pic) : null,
      start_date: String(item.start || ''),
      finish_date: String(item.finish || ''),
      progress_target: toSafeNumber(item.progress_target, 0),
      progress_actual: toSafeNumber(item.progress_actual, 0),
      status: String(item.status || (archiveType === 'FINISH' ? 'SELESAI' : 'I/P')),
      archived_at: item.archivedAt || new Date().toISOString(),
      delete_reason: item.deleteReason ? String(item.deleteReason) : null,
    }))
  );

  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('welding_archives')
      .upsert(rows, { onConflict: 'id,archive_type' });
    if (upsertErr) {
      throw new Error(`Gagal menyimpan arsip ${archiveType} ke Supabase: ${upsertErr.message}`);
    }
  }

  const { data: existingRows, error: fetchErr } = await supabase
    .from('welding_archives')
    .select('id')
    .eq('archive_type', archiveType);

  if (fetchErr) {
    throw new Error(`Gagal memeriksa arsip lama ${archiveType}: ${fetchErr.message}`);
  }

  const keepIds = new Set(rows.map((r) => r.id));
  const idsToDelete = (existingRows || [])
    .map((r: any) => toSafeNumber(r.id))
    .filter((id) => !keepIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('welding_archives')
      .delete()
      .eq('archive_type', archiveType)
      .in('id', idsToDelete);
    if (delErr) {
      throw new Error(`Gagal menghapus arsip usang ${archiveType}: ${delErr.message}`);
    }
  }
}

export async function syncArchivesToSupabase(
  archiveFinish: any[],
  archiveDeleted: any[]
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  await Promise.all([
    syncArchiveBucket(supabase, archiveFinish, 'FINISH'),
    syncArchiveBucket(supabase, archiveDeleted, 'DELETED'),
  ]);
}

export async function syncSettingsToSupabase(state: PersistedServerState): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from('welding_settings').upsert(
    {
      id: 'main',
      version: state.version,
      pin_code: state.pinCode || '1234',
      branding: state.branding,
      current_date_text: state.currentDateText,
      is_auto_date: state.isAutoDate,
      updated_at: state.updatedAt,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new Error(`Gagal menyimpan welding_settings ke Supabase: ${error.message}`);
  }
}

export async function saveStateToSupabase(
  state: PersistedServerState,
  scopes: { jobs?: boolean; archives?: boolean; settings?: boolean } = {
    jobs: true,
    archives: true,
    settings: true,
  }
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  if (scopes.jobs) {
    await syncJobsToSupabase(state.jobs, state.updatedAt);
  }
  if (scopes.archives) {
    await syncArchivesToSupabase(state.archiveFinish, state.archiveDeleted);
  }
  if (scopes.settings) {
    await syncSettingsToSupabase(state);
  } else {
    await bumpSettingsVersionInSupabase(state.updatedAt, {
      current_date_text: state.currentDateText,
      is_auto_date: state.isAutoDate,
    });
  }
}
