import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface BrandingState {
  companyLogoUrl: string | null;
  weldingLogoUrl: string | null;
  k3PosterUrl: string | null;
  useCustomK3Image: boolean;
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

const DEFAULT_BRANDING: BrandingState = {
  companyLogoUrl: null,
  weldingLogoUrl: null,
  k3PosterUrl: null,
  useCustomK3Image: false,
};

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

function getSupabaseCredentials(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

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

/**
 * Mengecek versi terbaru di Supabase secara sangat ringan (1 row)
 */
export async function fetchVersionFromSupabase(): Promise<{
  version: number;
  updatedAt: string;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('welding_settings')
    .select('version, updated_at')
    .eq('id', 'main')
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Gagal cek versi:', error.message);
    return null;
  }

  if (!data) return null;
  return {
    version: toSafeNumber(data.version, 1),
    updatedAt: data.updated_at || new Date().toISOString(),
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

  // Jika baris settings 'main' belum ada dan belum ada data job/arsip sama sekali,
  // berarti database masih kosong (baru dibuat) -> jangan menimpa state secara paksa.
  const hasSettings = Boolean(settingsRes.data);
  const jobRows = jobsRes.data || [];
  const archiveRows = archivesRes.data || [];

  if (!hasSettings && jobRows.length === 0 && archiveRows.length === 0) {
    return null;
  }

  const jobs = jobRows.map((row: any) => ({
    id: toSafeNumber(row.id),
    deskripsi: row.deskripsi || '',
    area: row.area || '',
    pic: row.pic || undefined,
    start: row.start_date || '',
    finish: row.finish_date || '',
    progress_target: toSafeNumber(row.progress_target, 0),
    progress_actual: toSafeNumber(row.progress_actual, 0),
    status: row.status || 'AKTIF',
  }));

  const archiveFinish: any[] = [];
  const archiveDeleted: any[] = [];

  for (const row of archiveRows) {
    const item: any = {
      id: toSafeNumber(row.id),
      deskripsi: row.deskripsi || '',
      area: row.area || '',
      pic: row.pic || undefined,
      start: row.start_date || '',
      finish: row.finish_date || '',
      progress_target: toSafeNumber(row.progress_target, 0),
      progress_actual: toSafeNumber(row.progress_actual, 0),
      status: row.status || (row.archive_type === 'FINISH' ? 'SELESAI' : 'AKTIF'),
      archivedAt: row.archived_at || new Date().toISOString(),
      archiveType: row.archive_type === 'DELETED' ? 'DELETED' : 'FINISH',
      ...(row.delete_reason ? { deleteReason: row.delete_reason } : {}),
    };

    if (row.archive_type === 'DELETED') {
      archiveDeleted.push(item);
    } else {
      archiveFinish.push(item);
    }
  }

  const s = settingsRes.data;
  const branding: BrandingState =
    s?.branding && typeof s.branding === 'object'
      ? {
          companyLogoUrl: s.branding.companyLogoUrl ?? null,
          weldingLogoUrl: s.branding.weldingLogoUrl ?? null,
          k3PosterUrl: s.branding.k3PosterUrl ?? null,
          useCustomK3Image: Boolean(s.branding.useCustomK3Image),
        }
      : { ...DEFAULT_BRANDING };

  return {
    version: toSafeNumber(s?.version, 1),
    jobs,
    archiveFinish,
    archiveDeleted,
    pinCode: typeof s?.pin_code === 'string' && s.pin_code ? s.pin_code : '1234',
    branding,
    currentDateText: s?.current_date_text || '16 September 2026',
    isAutoDate: typeof s?.is_auto_date === 'boolean' ? s.is_auto_date : true,
    updatedAt: s?.updated_at || new Date().toISOString(),
  };
}

/**
 * Menyinkronkan daftar pekerjaan aktif ke tabel welding_jobs
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
      status: String(job.status || 'AKTIF'),
      sort_order: idx,
      updated_at: updatedAt,
    }))
  );

  // 1. Upsert semua baris aktif terlebih dahulu (aman terhadap kegagalan tengah jalan)
  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('welding_jobs')
      .upsert(rows, { onConflict: 'id' });
    if (upsertErr) {
      throw new Error(`Gagal menyimpan welding_jobs ke Supabase: ${upsertErr.message}`);
    }
  }

  // 2. Hapus baris lama yang tidak ada di daftar terbaru
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
      status: String(item.status || (archiveType === 'FINISH' ? 'SELESAI' : 'AKTIF')),
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

/**
 * Menyinkronkan kedua kategori arsip (FINISH & DELETED) ke tabel welding_archives
 */
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

/**
 * Menyimpan pengaturan, branding (logo & poster K3), PIN, dan versi terbaru ke welding_settings
 */
export async function syncSettingsToSupabase(state: PersistedServerState): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from('welding_settings').upsert(
    {
      id: 'main',
      version: state.version,
      pin_code: state.pinCode,
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

/**
 * Menyimpan seluruh state ke Supabase (jobs + archives + settings).
 * Settings/version ditulis paling akhir agar instance lain selalu membaca data yang sudah utuh.
 */
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
  // Selalu perbarui settings/version di akhir untuk sinkronisasi versi lintas perangkat/instance
  await syncSettingsToSupabase(state);
}
