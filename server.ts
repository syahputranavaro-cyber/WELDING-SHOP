import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  isSupabaseConfigured,
  fetchVersionFromSupabase,
  loadStateFromSupabase,
  saveStateToSupabase,
  bumpSettingsVersionInSupabase,
  upsertSingleJobInSupabase,
  archiveSingleJobInSupabase,
  restoreSingleJobInSupabase,
  deleteSingleArchiveInSupabase,
  syncJobsToSupabase,
  syncArchivesToSupabase,
  type BrandingState,
} from './src/lib/supabaseStore';
import {
  verifyAdminCredentials,
  createAdminToken,
  verifyAdminAuthHeader,
  extractClientIp,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
} from './src/lib/serverAuth';

interface ServerState {
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

const DEFAULT_STATE: ServerState = {
  version: 1,
  jobs: [],
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Izinkan payload hingga 50MB agar logo perusahaan & poster K3 beresolusi tinggi tersimpan aman
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const DATA_DIR = path.join(process.cwd(), 'data');
  const DATA_FILE = path.join(DATA_DIR, 'app_state.json');
  const DATA_BACKUP_FILE = path.join(DATA_DIR, 'app_state_backup.json');

  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.error('Gagal membuat folder data:', e);
    }
  }

  let currentState: ServerState = { ...DEFAULT_STATE };

  function loadStateFromDisk() {
    for (const filePath of [DATA_FILE, DATA_BACKUP_FILE]) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            currentState = {
              ...DEFAULT_STATE,
              ...parsed,
              version: typeof parsed.version === 'number' && parsed.version > 0 ? parsed.version : 1,
              jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
              archiveFinish: Array.isArray(parsed.archiveFinish) ? parsed.archiveFinish : [],
              archiveDeleted: Array.isArray(parsed.archiveDeleted) ? parsed.archiveDeleted : [],
              pinCode: typeof parsed.pinCode === 'string' && parsed.pinCode ? parsed.pinCode : '1234',
              branding: parsed.branding || DEFAULT_STATE.branding,
              currentDateText: parsed.currentDateText || DEFAULT_STATE.currentDateText,
              isAutoDate: typeof parsed.isAutoDate === 'boolean' ? parsed.isAutoDate : true,
              updatedAt: parsed.updatedAt || new Date().toISOString(),
            };
            return true;
          }
        }
      } catch (err) {
        console.error(`Gagal membaca ${filePath}:`, err);
      }
    }
    return false;
  }

  const loadedSuccessfully = loadStateFromDisk();
  if (!loadedSuccessfully) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(currentState, null, 2), 'utf-8');
      fs.writeFileSync(DATA_BACKUP_FILE, JSON.stringify(currentState, null, 2), 'utf-8');
    } catch (e) {
      console.error('Gagal membuat inisialisasi awal file state:', e);
    }
  }

  function persistStateSync() {
    try {
      const dataStr = JSON.stringify(currentState, null, 2);
      const tmpFile = `${DATA_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, dataStr, 'utf-8');
      fs.renameSync(tmpFile, DATA_FILE);
      fs.writeFileSync(DATA_BACKUP_FILE, dataStr, 'utf-8');
    } catch (err) {
      console.error('Gagal menyimpan app_state.json secara atomik:', err);
    }
  }

  function buildLitePayload() {
    return {
      version: currentState.version,
      jobs: currentState.jobs,
      currentDateText: currentState.currentDateText,
      isAutoDate: currentState.isAutoDate,
      updatedAt: currentState.updatedAt,
      brandingUpdatedAt: currentState.branding?.updatedAt ?? null,
      archiveFinishCount: currentState.archiveFinish.length,
      archiveDeletedCount: currentState.archiveDeleted.length,
    };
  }

  // === INTEGRASI SUPABASE (Penyimpanan Cloud Permanen) ===
  let supabaseHydrated = false;
  let lastSupabaseCheckAt = 0;
  let writeQueue: Promise<unknown> = Promise.resolve();

  function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = writeQueue.then(task, task);
    writeQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async function hydrateOrRefreshFromSupabase(force = false): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const now = Date.now();
    if (!force && supabaseHydrated && now - lastSupabaseCheckAt < 2000) {
      return;
    }
    lastSupabaseCheckAt = now;

    try {
      if (!supabaseHydrated) {
        const remote = await loadStateFromSupabase();
        if (remote) {
          currentState = remote;
          persistStateSync();
          supabaseHydrated = true;
          console.log(
            `[Supabase] State berhasil dimuat (v${remote.version}, ${remote.jobs.length} job aktif, ${remote.archiveFinish.length + remote.archiveDeleted.length} arsip)`
          );
        }
        return;
      }

      const remoteVersion = await fetchVersionFromSupabase();
      if (remoteVersion && remoteVersion.version > currentState.version) {
        const remote = await loadStateFromSupabase();
        if (remote) {
          currentState = remote;
          persistStateSync();
        }
      }
    } catch (err) {
      console.error('[Supabase] Error sinkronisasi baca:', err);
    }
  }

  if (isSupabaseConfigured()) {
    console.log('[Supabase] Kredensial Supabase terdeteksi. Memuat data dari database cloud...');
    await hydrateOrRefreshFromSupabase(true);
  } else {
    console.log('[Supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur. Menggunakan cache lokal sementara.');
  }

  // === MULTI-DEVICE REAL-TIME BROADCAST (Server-Sent Events — Lite Payload) ===
  const sseClients = new Set<express.Response>();

  function broadcast(type: string, action: string, includeBranding = false) {
    const payload = JSON.stringify({
      type,
      action,
      version: currentState.version,
      updatedAt: currentState.updatedAt,
      clientCount: sseClients.size,
      lite: buildLitePayload(),
      ...(includeBranding ? { branding: currentState.branding } : {}),
    });
    const message = `data: ${payload}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function broadcastClientCount() {
    const payload = JSON.stringify({
      type: 'CLIENT_COUNT',
      clientCount: sseClients.size,
    });
    const message = `data: ${payload}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // === API AUTH ROUTES & WRITE PROTECTION MIDDLEWARE ===
  const requireAdminAuth: express.RequestHandler = (req, res, next) => {
    const check = verifyAdminAuthHeader(req.headers.authorization);
    if (!check.valid) {
      return res.status(401).json({
        success: false,
        message: check.error || 'Akses ditolak. Silakan login sebagai Admin terlebih dahulu.',
      });
    }
    next();
  };

  app.post('/api/auth/login', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const clientIp = extractClientIp(
      req.headers as Record<string, string | string[] | undefined>,
      req.ip
    );
    const rateCheck = checkLoginRateLimit(clientIp);
    if (!rateCheck.allowed) {
      const waitMin = Math.max(1, Math.ceil((rateCheck.retryAfterSec || 60) / 60));
      return res.status(429).json({
        success: false,
        message: `Terlalu banyak percobaan login gagal. Coba lagi dalam ${waitMin} menit.`,
      });
    }

    const { email, password } = req.body || {};
    if (!verifyAdminCredentials(email, password)) {
      recordLoginFailure(clientIp);
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah. Silakan periksa kembali.',
      });
    }

    clearLoginFailures(clientIp);
    const normalizedEmail = String(email).trim().toLowerCase();
    const { token, expiresAt } = createAdminToken(normalizedEmail);
    return res.json({
      success: true,
      token,
      expiresAt,
      user: {
        email: normalizedEmail,
        displayName: 'Admin Welding Shop',
        role: 'admin',
      },
    });
  });

  app.get('/api/auth/verify', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const check = verifyAdminAuthHeader(req.headers.authorization);
    if (!check.valid) {
      return res.status(401).json({ valid: false, message: check.error });
    }
    return res.json({ valid: true, email: check.email, role: 'admin' });
  });

  // === READ-ONLY API ROUTES (Terbuka untuk TV & Mode Tamu) ===
  app.get('/api/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      version: currentState.version,
      connectedClients: sseClients.size,
      storage: isSupabaseConfigured() ? 'supabase' : 'local',
      supportsSSE: true,
    });
  });

  app.get('/api/state/version', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      success: true,
      version: currentState.version,
      brandingUpdatedAt: currentState.branding?.updatedAt ?? null,
      clientCount: sseClients.size,
      supportsSSE: true,
      updatedAt: currentState.updatedAt,
    });
  });

  // State ringan: tanpa gambar Base64 & tanpa baris arsip
  app.get('/api/state/lite', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      success: true,
      version: currentState.version,
      clientCount: sseClients.size,
      supportsSSE: true,
      storage: isSupabaseConfigured() ? 'supabase' : 'local',
      data: buildLitePayload(),
    });
  });

  // Branding terpisah (logo perusahaan, logo Welding Shop, poster K3)
  app.get('/api/branding', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      success: true,
      version: currentState.version,
      brandingUpdatedAt: currentState.branding?.updatedAt ?? null,
      branding: currentState.branding,
    });
  });

  // Arsip on-demand (hanya dipanggil saat modal Arsip dibuka / ekspor cadangan)
  app.get('/api/archives', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      success: true,
      version: currentState.version,
      archiveFinish: currentState.archiveFinish,
      archiveDeleted: currentState.archiveDeleted,
    });
  });

  // State lengkap (untuk kompatibilitas & ekspor cadangan penuh)
  app.get('/api/state', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      success: true,
      version: currentState.version,
      clientCount: sseClients.size,
      supportsSSE: true,
      storage: isSupabaseConfigured() ? 'supabase' : 'local',
      data: currentState,
    });
  });

  // Endpoint SSE untuk sinkronisasi instan antar perangkat (payload ringan tanpa base64)
  app.get('/api/events', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders();

    sseClients.add(res);

    const initialSync = JSON.stringify({
      type: 'SYNC',
      version: currentState.version,
      clientCount: sseClients.size,
      lite: buildLitePayload(),
    });
    res.write(`data: ${initialSync}\n\n`);

    broadcastClientCount();

    req.on('close', () => {
      sseClients.delete(res);
      broadcastClientCount();
    });
  });

  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(': ping\n\n');
      } catch {
        sseClients.delete(client);
      }
    }
  }, 15000);

  // === WRITE API ROUTES (WAJIB ADMIN TOKEN) ===

  // Multi-Admin Safe: Simpan 1 pekerjaan (Add / Edit / Quick-Edit Actual)
  app.post('/api/jobs/upsert', requireAdminAuth, async (req, res) => {
    try {
      const { job, actionDescription } = req.body;
      if (!job || typeof job !== 'object') {
        return res.status(400).json({ success: false, message: 'Format data pekerjaan tidak valid' });
      }

      const nowIso = new Date().toISOString();
      await enqueueWrite(async () => {
        if (isSupabaseConfigured()) {
          const result = await upsertSingleJobInSupabase(job, nowIso);
          currentState.jobs = result.jobs;
          currentState.version = result.version;
          currentState.updatedAt = nowIso;
          supabaseHydrated = true;
          lastSupabaseCheckAt = Date.now();
        } else {
          const idx = currentState.jobs.findIndex((j) => j.id === job.id);
          if (idx >= 0) {
            currentState.jobs[idx] = job;
          } else {
            currentState.jobs = [job, ...currentState.jobs];
          }
          currentState.version += 1;
          currentState.updatedAt = nowIso;
        }
        persistStateSync();
      });

      broadcast('UPDATE_JOBS', actionDescription || `Pekerjaan "${job.deskripsi}" diperbarui`);

      res.json({
        success: true,
        version: currentState.version,
        jobs: currentState.jobs,
        message: 'Pekerjaan berhasil disimpan & disinkronkan',
      });
    } catch (err: any) {
      console.error('Error /api/jobs/upsert:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Bulk replace jobs (Impor Excel / Restore cadangan)
  app.post('/api/jobs', requireAdminAuth, async (req, res) => {
    try {
      const { jobs, actionDescription } = req.body;
      if (!Array.isArray(jobs)) {
        return res.status(400).json({ success: false, message: 'Format data jobs harus berupa array' });
      }

      const nowIso = new Date().toISOString();
      await enqueueWrite(async () => {
        if (isSupabaseConfigured()) {
          await syncJobsToSupabase(jobs, nowIso);
          currentState.version = await bumpSettingsVersionInSupabase(nowIso);
          supabaseHydrated = true;
          lastSupabaseCheckAt = Date.now();
        } else {
          currentState.version += 1;
        }
        currentState.jobs = jobs;
        currentState.updatedAt = nowIso;
        persistStateSync();
      });

      broadcast('UPDATE_JOBS', actionDescription || 'Pembaruan daftar pekerjaan');

      res.json({
        success: true,
        version: currentState.version,
        jobs: currentState.jobs,
        message: 'Daftar pekerjaan berhasil diperbarui dan disinkronkan ke seluruh perangkat',
      });
    } catch (err: any) {
      console.error('Error /api/jobs:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Multi-Admin Safe: Finish 1 pekerjaan -> pindahkan ke Arsip Selesai
  app.post('/api/jobs/finish', requireAdminAuth, async (req, res) => {
    try {
      const { job, jobs, archiveFinish, archiveDeleted, actionDescription } = req.body;
      const nowIso = new Date().toISOString();

      await enqueueWrite(async () => {
        if (job && typeof job === 'object') {
          const archivedItem = {
            ...job,
            progress_actual: 100,
            status: 'SELESAI',
            archivedAt: job.archivedAt || nowIso,
            archiveType: 'FINISH',
          };
          if (isSupabaseConfigured()) {
            const result = await archiveSingleJobInSupabase(archivedItem, 'FINISH', nowIso);
            currentState.jobs = result.jobs;
            currentState.version = result.version;
            supabaseHydrated = true;
            lastSupabaseCheckAt = Date.now();
          } else {
            currentState.jobs = currentState.jobs.filter((j) => j.id !== job.id);
            currentState.version += 1;
          }
          currentState.archiveFinish = [
            archivedItem,
            ...currentState.archiveFinish.filter((a) => a.id !== job.id),
          ];
          currentState.updatedAt = nowIso;
        } else {
          if (Array.isArray(jobs)) currentState.jobs = jobs;
          if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
          if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;
          currentState.updatedAt = nowIso;
          if (isSupabaseConfigured()) {
            await saveStateToSupabase(currentState, { jobs: true, archives: true, settings: false });
            currentState.version += 1;
          } else {
            currentState.version += 1;
          }
        }
        persistStateSync();
      });

      broadcast('UPDATE_FINISH_JOB', actionDescription || 'Pekerjaan selesai & diarsipkan');

      res.json({
        success: true,
        version: currentState.version,
        jobs: currentState.jobs,
        message: 'Pekerjaan selesai & arsip berhasil diperbarui secara aman',
      });
    } catch (err: any) {
      console.error('Error /api/jobs/finish:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Multi-Admin Safe: Hapus 1 pekerjaan -> pindahkan ke Arsip Dihapus
  app.post('/api/jobs/delete', requireAdminAuth, async (req, res) => {
    try {
      const { job, deleteReason, jobs, archiveDeleted, archiveFinish, actionDescription } = req.body;
      const nowIso = new Date().toISOString();

      await enqueueWrite(async () => {
        if (job && typeof job === 'object') {
          const archivedItem = {
            ...job,
            archivedAt: job.archivedAt || nowIso,
            archiveType: 'DELETED',
            deleteReason: deleteReason || 'Dihapus dari dashboard',
          };
          if (isSupabaseConfigured()) {
            const result = await archiveSingleJobInSupabase(
              archivedItem,
              'DELETED',
              nowIso,
              archivedItem.deleteReason
            );
            currentState.jobs = result.jobs;
            currentState.version = result.version;
            supabaseHydrated = true;
            lastSupabaseCheckAt = Date.now();
          } else {
            currentState.jobs = currentState.jobs.filter((j) => j.id !== job.id);
            currentState.version += 1;
          }
          currentState.archiveDeleted = [
            archivedItem,
            ...currentState.archiveDeleted.filter((a) => a.id !== job.id),
          ];
          currentState.updatedAt = nowIso;
        } else {
          if (Array.isArray(jobs)) currentState.jobs = jobs;
          if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;
          if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
          currentState.updatedAt = nowIso;
          if (isSupabaseConfigured()) {
            await saveStateToSupabase(currentState, { jobs: true, archives: true, settings: false });
          }
          currentState.version += 1;
        }
        persistStateSync();
      });

      broadcast('UPDATE_DELETE_JOB', actionDescription || 'Pekerjaan dihapus & dipindahkan ke arsip');

      res.json({
        success: true,
        version: currentState.version,
        jobs: currentState.jobs,
        message: 'Pekerjaan dihapus & arsip berhasil diperbarui secara aman',
      });
    } catch (err: any) {
      console.error('Error /api/jobs/delete:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Multi-Admin Safe: Pulihkan 1 pekerjaan dari arsip
  app.post('/api/jobs/restore', requireAdminAuth, async (req, res) => {
    try {
      const { item, archiveType, jobs, archiveFinish, archiveDeleted, actionDescription } = req.body;
      const nowIso = new Date().toISOString();

      await enqueueWrite(async () => {
        if (item && typeof item === 'object') {
          const resolvedType = archiveType === 'DELETED' ? 'DELETED' : 'FINISH';
          if (isSupabaseConfigured()) {
            const result = await restoreSingleJobInSupabase(item, resolvedType, nowIso);
            currentState.jobs = result.jobs;
            currentState.version = result.version;
            supabaseHydrated = true;
            lastSupabaseCheckAt = Date.now();
          } else {
            const { archivedAt, archiveType: _t, deleteReason, ...restored } = item;
            currentState.jobs = [
              { ...restored, status: String(restored.status || '').toUpperCase() === 'HOLD' ? 'HOLD' : 'I/P' },
              ...currentState.jobs.filter((j) => j.id !== item.id),
            ];
            currentState.version += 1;
          }
          if (resolvedType === 'FINISH') {
            currentState.archiveFinish = currentState.archiveFinish.filter((a) => a.id !== item.id);
          } else {
            currentState.archiveDeleted = currentState.archiveDeleted.filter((a) => a.id !== item.id);
          }
          currentState.updatedAt = nowIso;
        } else {
          if (Array.isArray(jobs)) currentState.jobs = jobs;
          if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
          if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;
          currentState.updatedAt = nowIso;
          if (isSupabaseConfigured()) {
            await saveStateToSupabase(currentState, { jobs: true, archives: true, settings: false });
          }
          currentState.version += 1;
        }
        persistStateSync();
      });

      broadcast('UPDATE_RESTORE_JOB', actionDescription || 'Pekerjaan dipulihkan dari arsip');

      res.json({
        success: true,
        version: currentState.version,
        jobs: currentState.jobs,
        message: 'Pekerjaan berhasil dipulihkan dari arsip',
      });
    } catch (err: any) {
      console.error('Error /api/jobs/restore:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Multi-Admin Safe: Hapus permanen 1 item arsip
  app.post('/api/archive/delete', requireAdminAuth, async (req, res) => {
    try {
      const { id, archiveType, actionDescription } = req.body;
      if (id == null || (archiveType !== 'FINISH' && archiveType !== 'DELETED')) {
        return res.status(400).json({ success: false, message: 'Parameter id dan archiveType tidak valid' });
      }

      const nowIso = new Date().toISOString();
      await enqueueWrite(async () => {
        if (isSupabaseConfigured()) {
          currentState.version = await deleteSingleArchiveInSupabase(Number(id), archiveType, nowIso);
          supabaseHydrated = true;
          lastSupabaseCheckAt = Date.now();
        } else {
          currentState.version += 1;
        }
        if (archiveType === 'FINISH') {
          currentState.archiveFinish = currentState.archiveFinish.filter((a) => a.id !== Number(id));
        } else {
          currentState.archiveDeleted = currentState.archiveDeleted.filter((a) => a.id !== Number(id));
        }
        currentState.updatedAt = nowIso;
        persistStateSync();
      });

      broadcast('UPDATE_ARCHIVE', actionDescription || 'Item arsip dihapus permanen');

      res.json({
        success: true,
        version: currentState.version,
        message: 'Item arsip berhasil dihapus permanen',
      });
    } catch (err: any) {
      console.error('Error /api/archive/delete:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Bulk update arsip
  app.post('/api/archive', requireAdminAuth, async (req, res) => {
    try {
      const { archiveFinish, archiveDeleted, actionDescription } = req.body;
      const nowIso = new Date().toISOString();

      await enqueueWrite(async () => {
        if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
        if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;

        if (isSupabaseConfigured()) {
          await syncArchivesToSupabase(currentState.archiveFinish, currentState.archiveDeleted);
          currentState.version = await bumpSettingsVersionInSupabase(nowIso);
          supabaseHydrated = true;
          lastSupabaseCheckAt = Date.now();
        } else {
          currentState.version += 1;
        }
        currentState.updatedAt = nowIso;
        persistStateSync();
      });

      broadcast('UPDATE_ARCHIVE', actionDescription || 'Pembaruan arsip pekerjaan');

      res.json({
        success: true,
        version: currentState.version,
        message: 'Arsip berhasil diperbarui dan disinkronkan ke seluruh perangkat',
      });
    } catch (err: any) {
      console.error('Error /api/archive:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Update branding (logo perusahaan, logo Welding Shop, poster K3)
  app.post('/api/branding', requireAdminAuth, async (req, res) => {
    try {
      const { branding } = req.body;
      if (!branding || typeof branding !== 'object') {
        return res.status(400).json({ success: false, message: 'Format data branding tidak valid' });
      }

      const nowIso = new Date().toISOString();
      await enqueueWrite(async () => {
        currentState.branding = {
          ...currentState.branding,
          ...branding,
          updatedAt: nowIso,
        };
        if (isSupabaseConfigured()) {
          currentState.version = await bumpSettingsVersionInSupabase(nowIso, {
            branding: currentState.branding,
          });
          supabaseHydrated = true;
          lastSupabaseCheckAt = Date.now();
        } else {
          currentState.version += 1;
        }
        currentState.updatedAt = nowIso;
        persistStateSync();
      });

      broadcast('UPDATE_BRANDING', 'Pembaruan gambar logo / poster', true);

      res.json({
        success: true,
        version: currentState.version,
        brandingUpdatedAt: nowIso,
        branding: currentState.branding,
        message: 'Branding berhasil diperbarui dan disinkronkan ke seluruh perangkat',
      });
    } catch (err: any) {
      console.error('Error /api/branding:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Update tanggal acuan dashboard (tidak menyentuh kolom gambar branding)
  app.post('/api/date', requireAdminAuth, async (req, res) => {
    try {
      const { currentDateText, isAutoDate } = req.body;
      const nowIso = new Date().toISOString();

      await enqueueWrite(async () => {
        if (typeof currentDateText === 'string') currentState.currentDateText = currentDateText;
        if (typeof isAutoDate === 'boolean') currentState.isAutoDate = isAutoDate;

        if (isSupabaseConfigured()) {
          currentState.version = await bumpSettingsVersionInSupabase(nowIso, {
            current_date_text: currentState.currentDateText,
            is_auto_date: currentState.isAutoDate,
          });
          supabaseHydrated = true;
          lastSupabaseCheckAt = Date.now();
        } else {
          currentState.version += 1;
        }
        currentState.updatedAt = nowIso;
        persistStateSync();
      });

      broadcast('UPDATE_DATE', 'Pembaruan tanggal dashboard');

      res.json({
        success: true,
        version: currentState.version,
        message: 'Tanggal berhasil disinkronkan ke seluruh perangkat',
      });
    } catch (err: any) {
      console.error('Error /api/date:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Simpan data lengkap ke server (Restore backup JSON / sinkronisasi penuh)
  app.post('/api/state', requireAdminAuth, async (req, res) => {
    try {
      const { jobs, archiveFinish, archiveDeleted, branding, currentDateText, isAutoDate } = req.body;
      const nowIso = new Date().toISOString();
      const hasBrandingPatch = Boolean(branding && typeof branding === 'object');

      await enqueueWrite(async () => {
        if (Array.isArray(jobs)) currentState.jobs = jobs;
        if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
        if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;
        if (hasBrandingPatch) {
          currentState.branding = {
            ...currentState.branding,
            ...branding,
            updatedAt: nowIso,
          };
        }
        if (typeof currentDateText === 'string') currentState.currentDateText = currentDateText;
        if (typeof isAutoDate === 'boolean') currentState.isAutoDate = isAutoDate;

        currentState.version += 1;
        currentState.updatedAt = nowIso;
        if (isSupabaseConfigured()) {
          await saveStateToSupabase(currentState, {
            jobs: Array.isArray(jobs),
            archives: Array.isArray(archiveFinish) || Array.isArray(archiveDeleted),
            settings: hasBrandingPatch,
          });
          supabaseHydrated = true;
          lastSupabaseCheckAt = Date.now();
        }
        persistStateSync();
      });

      broadcast('UPDATE_STATE', 'Pembaruan data lengkap dashboard', hasBrandingPatch);

      return res.json({
        success: true,
        version: currentState.version,
        message: 'Data berhasil disimpan dan disinkronkan ke seluruh perangkat',
      });
    } catch (err: any) {
      console.error('Error saat menyimpan ke /api/state:', err);
      return res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Kosongkan daftar pekerjaan aktif saja (arsip & branding tetap aman)
  app.post('/api/reset', requireAdminAuth, async (req, res) => {
    try {
      const nowIso = new Date().toISOString();
      await enqueueWrite(async () => {
        currentState.jobs = DEFAULT_STATE.jobs;
        currentState.currentDateText = getTodayIndonesian();
        currentState.isAutoDate = true;
        if (isSupabaseConfigured()) {
          await syncJobsToSupabase(DEFAULT_STATE.jobs, nowIso);
          currentState.version = await bumpSettingsVersionInSupabase(nowIso, {
            current_date_text: currentState.currentDateText,
            is_auto_date: true,
          });
          supabaseHydrated = true;
          lastSupabaseCheckAt = Date.now();
        } else {
          currentState.version += 1;
        }
        currentState.updatedAt = nowIso;
        persistStateSync();
      });

      broadcast('RESET', 'Daftar pekerjaan aktif dikosongkan');

      res.json({
        success: true,
        version: currentState.version,
        message: 'Daftar pekerjaan berhasil dikosongkan dan disinkronkan ke seluruh perangkat',
      });
    } catch (err: any) {
      console.error('Error /api/reset:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Welding Shop Dashboard berjalan di port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server start error:', err);
});
