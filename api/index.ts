import type { IncomingMessage, ServerResponse } from 'http';
import {
  isSupabaseConfigured,
  fetchVersionFromSupabase,
  loadStateFromSupabase,
  saveStateToSupabase,
  type PersistedServerState,
} from '../src/lib/supabaseStore.js';

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
  body?: any;
}

interface VercelResponse extends ServerResponse {
  status?: (statusCode: number) => VercelResponse;
  json?: (body: any) => VercelResponse;
  send?: (body: any) => VercelResponse;
}

const DEFAULT_JOBS = [
  {
    id: 1,
    deskripsi: 'Pabrikasi Frame Carry Roller D2822-V Qty 13 Set',
    area: 'PABRIK 6 BB 1',
    pic: 'Sadrak AT',
    start: '15 September 2026',
    finish: '27 September 2026',
    progress_target: 15.38,
    progress_actual: 0.0,
    status: 'AKTIF',
  },
  {
    id: 2,
    deskripsi: 'Pabrikasi Frame Carry Roller D2880-V Qty 25 Set',
    area: 'PABRIK 6 BB 1',
    pic: 'Agus Adi & ...',
    start: '15 September 2026',
    finish: '27 September 2026',
    progress_target: 15.38,
    progress_actual: 0.0,
    status: 'AKTIF',
  },
  {
    id: 3,
    deskripsi: 'Roll dan Pabrikasi Pipa 16" Karbon D1-TS-402',
    area: 'PABRIK 3',
    pic: 'Eka',
    start: '15 September 2026',
    finish: '24 September 2026',
    progress_target: 20.0,
    progress_actual: 0.0,
    status: 'AKTIF',
  },
  {
    id: 4,
    deskripsi: 'Roll & Pabrikasi Pipe 24" Karbon D1-TS-402',
    area: 'PABRIK 3',
    pic: 'Amirullah',
    start: '15 September 2026',
    finish: '25 September 2026',
    progress_target: 18.18,
    progress_actual: 8.0,
    status: 'AKTIF',
  },
  {
    id: 5,
    deskripsi: 'Cutting Chain Link Bucket Elevator DL-1103',
    area: 'PABRIK 7',
    pic: 'Laser Cutting',
    start: '14 September 2026',
    finish: '16 September 2026',
    progress_target: 100.0,
    progress_actual: 8.0,
    status: 'AKTIF',
  },
  {
    id: 6,
    deskripsi: 'Rebabbit Ring Halft Trust 103-JT QTY 1 EA',
    area: 'PP&P',
    pic: 'Abdul R wld',
    start: '14 September 2026',
    finish: '15 September 2026',
    progress_target: 100.0,
    progress_actual: 50.0,
    status: 'AKTIF',
  },
  {
    id: 7,
    deskripsi: 'Supporting Job Perbantuan PPE QTY 4 Orang',
    area: 'PABRIK 3',
    pic: 'Muliadi CS',
    start: '12 September 2026',
    finish: '2 Oktober 2026',
    progress_target: 23.81,
    progress_actual: 14.0,
    status: 'AKTIF',
  },
  {
    id: 8,
    deskripsi: 'Repair Support Bak Blank Tank PPE',
    area: 'PABRIK 2',
    pic: 'Irwan Musrad',
    start: '11 September 2026',
    finish: '16 September 2026',
    progress_target: 100.0,
    progress_actual: 85.0,
    status: 'AKTIF',
  },
  {
    id: 9,
    deskripsi: 'Pabrikasi Evacuation Ladder Steam Drum & Secondary Reformer Ammonia 1-R-102',
    area: 'PABRIK 3',
    pic: 'Purwono',
    start: '3 September 2026',
    finish: '16 September 2026',
    progress_target: 100.0,
    progress_actual: 100.0,
    status: 'AKTIF',
  },
  {
    id: 10,
    deskripsi: 'Supporting Job Perbantuan Operasi ALL Area Ammonia QTY 10 Orang',
    area: 'PABRIK 3',
    pic: 'Basir CS',
    start: '9 September 2026',
    finish: '29 September 2026',
    progress_target: 38.1,
    progress_actual: 28.5,
    status: 'AKTIF',
  },
];

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
    currentDateText: '16 September 2026',
    isAutoDate: true,
    updatedAt: new Date().toISOString(),
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
      } catch (err) {
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
    // === GET /api/health ===
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

    // === GET /api/state ===
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

    // === GET /api/state/version ===
    if (method === 'GET' && route === '/state/version') {
      const vInfo = isSupabaseConfigured() ? await fetchVersionFromSupabase() : null;
      return sendJson(res, 200, {
        success: true,
        version: vInfo?.version ?? 1,
        clientCount: 1,
        supportsSSE: false,
        updatedAt: vInfo?.updatedAt ?? new Date().toISOString(),
      });
    }

    // === SEMUA OPERASI TULIS (POST) WAJIB TERHUBUNG KE SUPABASE ===
    if (method === 'POST') {
      if (!isSupabaseConfigured()) {
        return sendJson(res, 503, {
          success: false,
          message:
            'Database Supabase belum dikonfigurasi di Vercel. Tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Settings > Environment Variables lalu Redeploy.',
        });
      }

      const body = await readJsonBody(req);
      const currentState = await loadExistingOrDefault();
      const nextVersion = Math.max(currentState.version || 1, 1) + 1;
      const nowIso = new Date().toISOString();

      // POST /api/jobs
      if (route === '/jobs') {
        const { jobs } = body;
        if (!Array.isArray(jobs)) {
          return sendJson(res, 400, {
            success: false,
            message: 'Format data jobs harus berupa array',
          });
        }

        const nextState: PersistedServerState = {
          ...currentState,
          jobs,
          version: nextVersion,
          updatedAt: nowIso,
        };
        await saveStateToSupabase(nextState, { jobs: true, settings: true });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Daftar pekerjaan berhasil diperbarui dan disimpan ke Supabase',
          data: nextState,
        });
      }

      // POST /api/jobs/finish
      if (route === '/jobs/finish') {
        const { jobs, archiveFinish, archiveDeleted } = body;
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
          settings: true,
        });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Pekerjaan selesai & arsip berhasil diperbarui secara aman',
          data: nextState,
        });
      }

      // POST /api/jobs/delete
      if (route === '/jobs/delete') {
        const { jobs, archiveDeleted, archiveFinish } = body;
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
          settings: true,
        });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Pekerjaan dihapus & arsip berhasil diperbarui secara aman',
          data: nextState,
        });
      }

      // POST /api/jobs/restore
      if (route === '/jobs/restore') {
        const { jobs, archiveFinish, archiveDeleted } = body;
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
          settings: true,
        });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Pekerjaan berhasil dipulihkan dari arsip',
          data: nextState,
        });
      }

      // POST /api/archive
      if (route === '/archive') {
        const { archiveFinish, archiveDeleted } = body;
        const nextState: PersistedServerState = {
          ...currentState,
          archiveFinish: Array.isArray(archiveFinish)
            ? archiveFinish
            : currentState.archiveFinish,
          archiveDeleted: Array.isArray(archiveDeleted)
            ? archiveDeleted
            : currentState.archiveDeleted,
          version: nextVersion,
          updatedAt: nowIso,
        };
        await saveStateToSupabase(nextState, { archives: true, settings: true });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Arsip berhasil diperbarui dan disimpan ke Supabase',
          data: {
            archiveFinish: nextState.archiveFinish,
            archiveDeleted: nextState.archiveDeleted,
          },
        });
      }

      // POST /api/branding
      if (route === '/branding') {
        const { branding } = body;
        if (!branding || typeof branding !== 'object') {
          return sendJson(res, 400, {
            success: false,
            message: 'Format data branding tidak valid',
          });
        }

        const nextState: PersistedServerState = {
          ...currentState,
          branding: {
            ...currentState.branding,
            ...branding,
          },
          version: nextVersion,
          updatedAt: nowIso,
        };
        await saveStateToSupabase(nextState, { settings: true });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Branding berhasil diperbarui dan disimpan ke Supabase',
          data: nextState,
        });
      }

      // POST /api/date
      if (route === '/date') {
        const { currentDateText, isAutoDate } = body;
        const nextState: PersistedServerState = {
          ...currentState,
          currentDateText:
            typeof currentDateText === 'string'
              ? currentDateText
              : currentState.currentDateText,
          isAutoDate:
            typeof isAutoDate === 'boolean' ? isAutoDate : currentState.isAutoDate,
          version: nextVersion,
          updatedAt: nowIso,
        };
        await saveStateToSupabase(nextState, { settings: true });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Tanggal berhasil disimpan ke Supabase',
          data: nextState,
        });
      }

      // POST /api/pin
      if (route === '/pin') {
        const { pinCode } = body;
        if (typeof pinCode !== 'string' || pinCode.trim().length < 4) {
          return sendJson(res, 400, {
            success: false,
            message: 'PIN harus berupa minimal 4 digit angka',
          });
        }

        const nextState: PersistedServerState = {
          ...currentState,
          pinCode: pinCode.trim(),
          version: nextVersion,
          updatedAt: nowIso,
        };
        await saveStateToSupabase(nextState, { settings: true });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'PIN berhasil diperbarui dan disimpan ke Supabase',
        });
      }

      // POST /api/state (Restore backup lengkap / sinkronisasi penuh)
      if (route === '/state') {
        const {
          jobs,
          archiveFinish,
          archiveDeleted,
          pinCode,
          branding,
          currentDateText,
          isAutoDate,
        } = body;

        const nextState: PersistedServerState = {
          ...currentState,
          jobs: Array.isArray(jobs) ? jobs : currentState.jobs,
          archiveFinish: Array.isArray(archiveFinish)
            ? archiveFinish
            : currentState.archiveFinish,
          archiveDeleted: Array.isArray(archiveDeleted)
            ? archiveDeleted
            : currentState.archiveDeleted,
          pinCode:
            typeof pinCode === 'string' && pinCode ? pinCode : currentState.pinCode,
          branding:
            branding && typeof branding === 'object'
              ? { ...currentState.branding, ...branding }
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
          settings: true,
        });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Data berhasil disimpan dan disinkronkan ke Supabase',
          data: nextState,
        });
      }

      // POST /api/reset
      if (route === '/reset') {
        const nextState: PersistedServerState = {
          ...currentState,
          jobs: DEFAULT_JOBS,
          currentDateText: '16 September 2026',
          isAutoDate: true,
          version: nextVersion,
          updatedAt: nowIso,
        };
        await saveStateToSupabase(nextState, { jobs: true, settings: true });

        return sendJson(res, 200, {
          success: true,
          version: nextState.version,
          message: 'Data berhasil direset dan disimpan ke Supabase',
          data: nextState,
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
