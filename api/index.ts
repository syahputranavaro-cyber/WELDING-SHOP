import type { IncomingMessage, ServerResponse } from 'http';
import {
  isSupabaseConfigured,
  fetchVersionFromSupabase,
  loadLiteStateFromSupabase,
  loadBrandingFromSupabase,
  loadArchivesFromSupabase,
  loadStateFromSupabase,
  saveStateToSupabase,
  bumpSettingsVersionInSupabase,
  upsertSingleJobInSupabase,
  archiveSingleJobInSupabase,
  restoreSingleJobInSupabase,
  deleteSingleArchiveInSupabase,
  syncJobsToSupabase,
  syncArchivesToSupabase,
  type PersistedServerState,
  type LiteServerState,
} from '../src/lib/supabaseStore.js';
import {
  verifyAdminCredentials,
  createAdminToken,
  verifyAdminAuthHeader,
  extractClientIp,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
} from '../src/lib/serverAuth.js';

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
  body?: any;
}

interface VercelResponse extends ServerResponse {
  status?: (statusCode: number) => VercelResponse;
  json?: (body: any) => VercelResponse;
  send?: (body: any) => VercelResponse;
}

const DEFAULT_JOBS: any[] = [];

function getTodayIndonesian(): string {
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

function createDefaultState(): PersistedServerState {
  return {
    version: 1,
    jobs: DEFAULT_JOBS,
    archiveFinish: [],
    archiveDeleted: [],
    pinCode: '1234',
    branding: {
      companyLogoUrl: null,
      weldingLogoUrl: null,
      k3PosterUrl: null,
      useCustomK3Image: false,
    },
    currentDateText: getTodayIndonesian(),
    isAutoDate: true,
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultLiteState(): LiteServerState {
  return {
    version: 1,
    jobs: DEFAULT_JOBS,
    currentDateText: getTodayIndonesian(),
    isAutoDate: true,
    updatedAt: new Date().toISOString(),
    brandingUpdatedAt: null,
    archiveFinishCount: 0,
    archiveDeletedCount: 0,
  };
}

function sendJson(res: VercelResponse, statusCode: number, data: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

function extractApiRoute(req: VercelRequest): string {
  const queryPath = req.query?.path;
  if (typeof queryPath === 'string' && queryPath.trim()) {
    return '/' + queryPath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  }
  if (Array.isArray(queryPath) && queryPath.length > 0) {
    return '/' + queryPath.join('/').replace(/^\/+/, '').replace(/\/+$/, '');
  }

  try {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const pathParam = parsedUrl.searchParams.get('path');
    if (pathParam && pathParam.trim()) {
      return '/' + pathParam.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    }
    const cleaned = parsedUrl.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
    return '/' + cleaned;
  } catch {
    return '/';
  }
}

async function readJsonBody(req: VercelRequest): Promise<any> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return req.body.trim() ? JSON.parse(req.body) : {};
    }
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf-8').trim();
      return str ? JSON.parse(str) : {};
    }
    return req.body;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Format JSON request tidak valid'));
      }
    });
    req.on('error', reject);
  });
}

async function loadExistingOrDefault(): Promise<PersistedServerState> {
  const remote = await loadStateFromSupabase();
  return remote || createDefaultState();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = (req.method || 'GET').toUpperCase();
  const route = extractApiRoute(req);

  if (method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    // === GET /api/health (juga dipanggil harian oleh Vercel Cron agar Supabase Free Tier tidak auto-pause) ===
    if (method === 'GET' && (route === '/health' || route === '/')) {
      const configured = isSupabaseConfigured();
      let version = 1;
      let supabaseReady = false;

      if (configured) {
        const vInfo = await fetchVersionFromSupabase();
        if (vInfo) {
          version = vInfo.version;
          supabaseReady = true;
        }
      }

      return sendJson(res, 200, {
        status: 'ok',
        time: new Date().toISOString(),
        version,
        connectedClients: 1,
        storage: configured ? 'supabase' : 'unconfigured',
        supabaseInitialized: supabaseReady,
        platform: 'vercel',
        supportsSSE: false,
      });
    }

    // === GET /api/events (SSE tidak dipakai pada Vercel serverless; gunakan polling ringan) ===
    if (method === 'GET' && route === '/events') {
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 204;
      res.end();
      return;
    }

    // === GET /api/state/version (super ringan: 1 row tanpa gambar) ===
    if (method === 'GET' && route === '/state/version') {
      const vInfo = isSupabaseConfigured() ? await fetchVersionFromSupabase() : null;
      return sendJson(res, 200, {
        success: true,
        version: vInfo?.version ?? 1,
        brandingUpdatedAt: vInfo?.brandingUpdatedAt ?? null,
        clientCount: 1,
        supportsSSE: false,
        updatedAt: vInfo?.updatedAt ?? new Date().toISOString(),
      });
    }

    // === GET /api/state/lite (hemat bandwidth: hanya jobs + tanggal + hitungan arsip, tanpa base64 gambar & tanpa baris arsip) ===
    if (method === 'GET' && route === '/state/lite') {
      const lite = isSupabaseConfigured()
        ? (await loadLiteStateFromSupabase()) || createDefaultLiteState()
        : createDefaultLiteState();

      return sendJson(res, 200, {
        success: true,
        version: lite.version,
        clientCount: 1,
        supportsSSE: false,
        storage: isSupabaseConfigured() ? 'supabase' : 'unconfigured',
        data: lite,
      });
    }

    // === GET /api/branding (hanya diambil saat buka awal atau saat logo/poster berubah) ===
    if (method === 'GET' && route === '/branding') {
      const bRes = isSupabaseConfigured() ? await loadBrandingFromSupabase() : null;
      return sendJson(res, 200, {
        success: true,
        version: bRes?.version ?? 1,
        brandingUpdatedAt: bRes?.brandingUpdatedAt ?? null,
        branding: bRes?.branding ?? createDefaultState().branding,
      });
    }

    // === GET /api/archives (on-demand saat modal Arsip dibuka atau ekspor cadangan) ===
    if (method === 'GET' && route === '/archives') {
      const aRes = isSupabaseConfigured() ? await loadArchivesFromSupabase() : null;
      return sendJson(res, 200, {
        success: true,
        version: aRes?.version ?? 1,
        archiveFinish: aRes?.archiveFinish ?? [],
        archiveDeleted: aRes?.archiveDeleted ?? [],
      });
    }

    // === GET /api/state (lengkap — untuk kompatibilitas & ekspor cadangan) ===
    if (method === 'GET' && route === '/state') {
      const state = isSupabaseConfigured()
        ? (await loadStateFromSupabase()) || createDefaultState()
        : createDefaultState();

      return sendJson(res, 200, {
        success: true,
        version: state.version,
        clientCount: 1,
        supportsSSE: false,
        storage: isSupabaseConfigured() ? 'supabase' : 'unconfigured',
        data: state,
      });
    }

    // === GET /api/auth/verify ===
    if (method === 'GET' && route === '/auth/verify') {
      const check = verifyAdminAuthHeader(req.headers.authorization);
      if (!check.valid) {
        return sendJson(res, 401, { valid: false, message: check.error });
      }
      return sendJson(res, 200, { valid: true, email: check.email, role: 'admin' });
    }

    // === POST /api/auth/login (Verifikasi kredensial Admin + Rate Limit) ===
    if (method === 'POST' && route === '/auth/login') {
      const clientIp = extractClientIp(
        req.headers as Record<string, string | string[] | undefined>,
        req.socket?.remoteAddress
      );
      const rateCheck = checkLoginRateLimit(clientIp);
      if (!rateCheck.allowed) {
        const waitMin = Math.max(1, Math.ceil((rateCheck.retryAfterSec || 60) / 60));
        return sendJson(res, 429, {
          success: false,
          message: `Terlalu banyak percobaan login gagal. Coba lagi dalam ${waitMin} menit.`,
        });
      }

      const body = await readJsonBody(req);
      const { email, password } = body || {};
      if (!verifyAdminCredentials(email, password)) {
        recordLoginFailure(clientIp);
        return sendJson(res, 401, {
          success: false,
          message: 'Email atau password salah. Silakan periksa kembali.',
        });
      }

      clearLoginFailures(clientIp);
      const normalizedEmail = String(email).trim().toLowerCase();
      const { token, expiresAt } = createAdminToken(normalizedEmail);
      return sendJson(res, 200, {
        success: true,
        token,
        expiresAt,
        user: {
          email: normalizedEmail,
          displayName: 'Admin Welding Shop',
          role: 'admin',
        },
      });
    }

    // === SEMUA OPERASI TULIS (POST) WAJIB TEROTORISASI ADMIN & TERHUBUNG KE SUPABASE ===
    if (method === 'POST') {
      const authCheck = verifyAdminAuthHeader(req.headers.authorization);
      if (!authCheck.valid) {
        return sendJson(res, 401, {
          success: false,
          message:
            authCheck.error ||
            'Akses ditolak. Silakan login sebagai Admin terlebih dahulu.',
        });
      }

      if (!isSupabaseConfigured()) {
        return sendJson(res, 503, {
          success: false,
          message:
            'Database Supabase belum dikonfigurasi di Vercel. Tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Settings > Environment Variables lalu Redeploy.',
        });
      }

      const body = await readJsonBody(req);
      const nowIso = new Date().toISOString();

      // POST /api/jobs/upsert (Multi-Admin Safe: simpan 1 pekerjaan saja tanpa menimpa editan Admin lain)
      if (route === '/jobs/upsert') {
        const { job } = body;
        if (!job || typeof job !== 'object') {
          return sendJson(res, 400, {
            success: false,
            message: 'Format data pekerjaan tidak valid',
          });
        }

        const result = await upsertSingleJobInSupabase(job, nowIso);
        return sendJson(res, 200, {
          success: true,
          version: result.version,
          jobs: result.jobs,
          message: 'Pekerjaan berhasil disimpan dan disinkronkan ke Supabase',
        });
      }

      // POST /api/jobs (Bulk replace untuk Impor Excel / Restore Backup)
      if (route === '/jobs') {
        const { jobs } = body;
        if (!Array.isArray(jobs)) {
          return sendJson(res, 400, {
            success: false,
            message: 'Format data jobs harus berupa array',
          });
        }

        await syncJobsToSupabase(jobs, nowIso);
        const version = await bumpSettingsVersionInSupabase(nowIso);

        return sendJson(res, 200, {
          success: true,
          version,
          jobs,
          message: 'Daftar pekerjaan berhasil diperbarui dan disimpan ke Supabase',
        });
      }

      // POST /api/jobs/finish (Mendukung single-job multi-admin-safe maupun bulk)
      if (route === '/jobs/finish') {
        if (body.job && typeof body.job === 'object') {
          const result = await archiveSingleJobInSupabase(body.job, 'FINISH', nowIso);
          return sendJson(res, 200, {
            success: true,
            version: result.version,
            jobs: result.jobs,
            message: 'Pekerjaan selesai & arsip berhasil diperbarui secara aman',
          });
        }

        const { jobs, archiveFinish, archiveDeleted } = body;
        const currentState = await loadExistingOrDefault();
        const nextVersion = Math.max(currentState.version || 1, 1) + 1;
        const nextState: PersistedServerState = {
          ...currentState,
          jobs: Array.isArray(jobs) ? jobs : currentState.jobs,
          archiveFinish: Array.isArray(archiveFinish)
            ? archiveFinish
            : currentState.archiveFinish,
          archiveDeleted: Array.isArray(archiveDeleted)
            ? archiveDeleted
            : currentState.archiveDeleted,
          version: nextVersion,
          updatedAt: nowIso,
        };
        await saveStateToSupabase(nextState, {
          jobs: true,
          archives: true,
          settings: false,
        });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          jobs: nextState.jobs,
          message: 'Pekerjaan selesai & arsip berhasil diperbarui secara aman',
        });
      }

      // POST /api/jobs/delete (Mendukung single-job multi-admin-safe maupun bulk)
      if (route === '/jobs/delete') {
        if (body.job && typeof body.job === 'object') {
          const result = await archiveSingleJobInSupabase(
            body.job,
            'DELETED',
            nowIso,
            body.deleteReason
          );
          return sendJson(res, 200, {
            success: true,
            version: result.version,
            jobs: result.jobs,
            message: 'Pekerjaan dihapus & arsip berhasil diperbarui secara aman',
          });
        }

        const { jobs, archiveDeleted, archiveFinish } = body;
        const currentState = await loadExistingOrDefault();
        const nextVersion = Math.max(currentState.version || 1, 1) + 1;
        const nextState: PersistedServerState = {
          ...currentState,
          jobs: Array.isArray(jobs) ? jobs : currentState.jobs,
          archiveDeleted: Array.isArray(archiveDeleted)
            ? archiveDeleted
            : currentState.archiveDeleted,
          archiveFinish: Array.isArray(archiveFinish)
            ? archiveFinish
            : currentState.archiveFinish,
          version: nextVersion,
          updatedAt: nowIso,
        };
        await saveStateToSupabase(nextState, {
          jobs: true,
          archives: true,
          settings: false,
        });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          jobs: nextState.jobs,
          message: 'Pekerjaan dihapus & arsip berhasil diperbarui secara aman',
        });
      }

      // POST /api/jobs/restore (Mendukung single-item multi-admin-safe maupun bulk)
      if (route === '/jobs/restore') {
        if (body.item && typeof body.item === 'object') {
          const archiveType = body.archiveType === 'DELETED' ? 'DELETED' : 'FINISH';
          const result = await restoreSingleJobInSupabase(body.item, archiveType, nowIso);
          return sendJson(res, 200, {
            success: true,
            version: result.version,
            jobs: result.jobs,
            message: 'Pekerjaan berhasil dipulihkan dari arsip',
          });
        }

        const { jobs, archiveFinish, archiveDeleted } = body;
        const currentState = await loadExistingOrDefault();
        const nextVersion = Math.max(currentState.version || 1, 1) + 1;
        const nextState: PersistedServerState = {
          ...currentState,
          jobs: Array.isArray(jobs) ? jobs : currentState.jobs,
          archiveFinish: Array.isArray(archiveFinish)
            ? archiveFinish
            : currentState.archiveFinish,
          archiveDeleted: Array.isArray(archiveDeleted)
            ? archiveDeleted
            : currentState.archiveDeleted,
          version: nextVersion,
          updatedAt: nowIso,
        };
        await saveStateToSupabase(nextState, {
          jobs: true,
          archives: true,
          settings: false,
        });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          jobs: nextState.jobs,
          message: 'Pekerjaan berhasil dipulihkan dari arsip',
        });
      }

      // POST /api/archive/delete (Hapus permanen 1 item arsip secara aman)
      if (route === '/archive/delete') {
        const { id, archiveType } = body;
        if (id == null || (archiveType !== 'FINISH' && archiveType !== 'DELETED')) {
          return sendJson(res, 400, {
            success: false,
            message: 'Parameter id dan archiveType tidak valid',
          });
        }

        const version = await deleteSingleArchiveInSupabase(Number(id), archiveType, nowIso);
        return sendJson(res, 200, {
          success: true,
          version,
          message: 'Item arsip berhasil dihapus permanen',
        });
      }

      // POST /api/archive (Bulk sync arsip)
      if (route === '/archive') {
        const { archiveFinish, archiveDeleted } = body;
        await syncArchivesToSupabase(
          Array.isArray(archiveFinish) ? archiveFinish : [],
          Array.isArray(archiveDeleted) ? archiveDeleted : []
        );
        const version = await bumpSettingsVersionInSupabase(nowIso);

        return sendJson(res, 200, {
          success: true,
          version,
          message: 'Arsip berhasil diperbarui dan disimpan ke Supabase',
        });
      }

      // POST /api/branding (Hanya perbarui kolom branding + stempel updatedAt)
      if (route === '/branding') {
        const { branding } = body;
        if (!branding || typeof branding !== 'object') {
          return sendJson(res, 400, {
            success: false,
            message: 'Format data branding tidak valid',
          });
        }

        const existingBranding = (await loadBrandingFromSupabase())?.branding ?? createDefaultState().branding;
        const mergedBranding = {
          ...existingBranding,
          ...branding,
          updatedAt: nowIso,
        };
        const version = await bumpSettingsVersionInSupabase(nowIso, {
          branding: mergedBranding,
        });

        return sendJson(res, 200, {
          success: true,
          version,
          brandingUpdatedAt: nowIso,
          branding: mergedBranding,
          message: 'Branding berhasil diperbarui dan disimpan ke Supabase',
        });
      }

      // POST /api/date (Hanya perbarui kolom tanggal — tidak menyentuh gambar branding)
      if (route === '/date') {
        const { currentDateText, isAutoDate } = body;
        const version = await bumpSettingsVersionInSupabase(nowIso, {
          ...(typeof currentDateText === 'string' ? { current_date_text: currentDateText } : {}),
          ...(typeof isAutoDate === 'boolean' ? { is_auto_date: isAutoDate } : {}),
        });

        return sendJson(res, 200, {
          success: true,
          version,
          message: 'Tanggal berhasil disimpan ke Supabase',
        });
      }

      // POST /api/state (Restore backup lengkap / sinkronisasi penuh)
      if (route === '/state') {
        const {
          jobs,
          archiveFinish,
          archiveDeleted,
          branding,
          currentDateText,
          isAutoDate,
        } = body;

        const currentState = await loadExistingOrDefault();
        const nextVersion = Math.max(currentState.version || 1, 1) + 1;
        const hasBrandingPatch = Boolean(branding && typeof branding === 'object');
        const nextState: PersistedServerState = {
          ...currentState,
          jobs: Array.isArray(jobs) ? jobs : currentState.jobs,
          archiveFinish: Array.isArray(archiveFinish)
            ? archiveFinish
            : currentState.archiveFinish,
          archiveDeleted: Array.isArray(archiveDeleted)
            ? archiveDeleted
            : currentState.archiveDeleted,
          branding: hasBrandingPatch
            ? { ...currentState.branding, ...branding, updatedAt: nowIso }
            : currentState.branding,
          currentDateText:
            typeof currentDateText === 'string'
              ? currentDateText
              : currentState.currentDateText,
          isAutoDate:
            typeof isAutoDate === 'boolean' ? isAutoDate : currentState.isAutoDate,
          version: nextVersion,
          updatedAt: nowIso,
        };

        await saveStateToSupabase(nextState, {
          jobs: Array.isArray(jobs),
          archives: Array.isArray(archiveFinish) || Array.isArray(archiveDeleted),
          settings: hasBrandingPatch,
        });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Data berhasil disimpan dan disinkronkan ke Supabase',
          data: nextState,
        });
      }

      // POST /api/reset (Kosongkan daftar pekerjaan aktif saja — arsip & branding tetap aman)
      if (route === '/reset') {
        await syncJobsToSupabase(DEFAULT_JOBS, nowIso);
        const version = await bumpSettingsVersionInSupabase(nowIso, {
          current_date_text: getTodayIndonesian(),
          is_auto_date: true,
        });

        return sendJson(res, 200, {
          success: true,
          version,
          message: 'Daftar pekerjaan berhasil dikosongkan dan disimpan ke Supabase',
        });
      }
    }

    return sendJson(res, 404, {
      success: false,
      message: `Endpoint ${method} /api${route} tidak ditemukan`,
    });
  } catch (err: any) {
    console.error(`[Vercel API Error] ${method} ${route}:`, err);
    return sendJson(res, 500, {
      success: false,
      message: err?.message || 'Terjadi kesalahan pada server API',
    });
  }
}
