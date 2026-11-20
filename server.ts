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
} from './src/lib/supabaseStore';
import {
  verifyAdminCredentials,
  createAdminToken,
  verifyAdminAuthHeader,
} from './src/lib/serverAuth';

interface ServerState {
  version: number;
  jobs: any[];
  archiveFinish: any[];
  archiveDeleted: any[];
  pinCode: string;
  branding: {
    companyLogoUrl: string | null;
    weldingLogoUrl: string | null;
    k3PosterUrl: string | null;
    useCustomK3Image: boolean;
  };
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

  // Pastikan folder data selalu tersedia
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.error('Gagal membuat folder data:', e);
    }
  }

  // Load existing state dari disk ke memori saat server dinyalakan
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

  // Penyimpanan state aman dan atomik ke disk lokal (sebagai cache/fallback)
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

  async function commitState(
    scopes: { jobs?: boolean; archives?: boolean; settings?: boolean } = {
      jobs: true,
      archives: true,
      settings: true,
    }
  ): Promise<void> {
    if (isSupabaseConfigured()) {
      const remoteVersion = await fetchVersionFromSupabase();
      if (remoteVersion && remoteVersion.version >= currentState.version) {
        currentState.version = remoteVersion.version + 1;
      }
      await saveStateToSupabase(currentState, scopes);
      supabaseHydrated = true;
      lastSupabaseCheckAt = Date.now();
    }
    persistStateSync();
  }

  // Muat state awal dari Supabase saat server menyala
  if (isSupabaseConfigured()) {
    console.log('[Supabase] Kredensial Supabase terdeteksi. Memuat data dari database cloud...');
    await hydrateOrRefreshFromSupabase(true);
  } else {
    console.log('[Supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur. Menggunakan cache lokal sementara.');
  }

  // === MULTI-DEVICE REAL-TIME BROADCAST (Server-Sent Events) ===
  const sseClients = new Set<express.Response>();

  function broadcast(type: string, action: string, extra?: any) {
    const payload = JSON.stringify({
      type,
      action,
      version: currentState.version,
      updatedAt: currentState.updatedAt,
      clientCount: sseClients.size,
      data: currentState,
      ...extra,
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
    const { email, password } = req.body || {};
    if (!verifyAdminCredentials(email, password)) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah. Silakan periksa kembali.',
      });
    }
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

  // === API ROUTES ===
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

  // Ambil state lengkap (selalu cek versi terbaru dari Supabase jika aktif)
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

  // Cek versi state (sangat ringan untuk fallback polling & sinkronisasi lintas instance)
  app.get('/api/state/version', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      success: true,
      version: currentState.version,
      clientCount: sseClients.size,
      supportsSSE: true,
      updatedAt: currentState.updatedAt,
    });
  });

  // Endpoint Server-Sent Events (SSE) untuk sinkronisasi instan antar perangkat
  app.get('/api/events', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Nonaktifkan proxy buffering pada reverse proxy Nginx
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders();

    sseClients.add(res);

    // Kirim data sinkronisasi awal saat perangkat terhubung
    const initialSync = JSON.stringify({
      type: 'SYNC',
      version: currentState.version,
      clientCount: sseClients.size,
      data: currentState,
    });
    res.write(`data: ${initialSync}\n\n`);

    broadcastClientCount();

    req.on('close', () => {
      sseClients.delete(res);
      broadcastClientCount();
    });
  });

  // Heartbeat ping setiap 15 detik agar koneksi tetap hidup melalui reverse proxy
  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(': ping\n\n');
      } catch {
        sseClients.delete(client);
      }
    }
  }, 15000);

  // Update spesifik daftar pekerjaan (Jobs)
  app.post('/api/jobs', requireAdminAuth, async (req, res) => {
    try {
      const { jobs, actionDescription } = req.body;
      if (!Array.isArray(jobs)) {
        return res.status(400).json({ success: false, message: 'Format data jobs harus berupa array' });
      }

      await enqueueWrite(async () => {
        currentState.jobs = jobs;
        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ jobs: true, settings: true });
      });

      broadcast('UPDATE_JOBS', actionDescription || 'Pembaruan daftar pekerjaan', {
        jobsCount: jobs.length,
      });

      res.json({
        success: true,
        version: currentState.version,
        message: 'Daftar pekerjaan berhasil diperbarui dan disinkronkan ke seluruh perangkat',
        data: currentState,
      });
    } catch (err: any) {
      console.error('Error /api/jobs:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Operasi ATOMIK 1: Selesaikan pekerjaan (Finish) sekaligus arsipkan dalam 1 transaksi
  app.post('/api/jobs/finish', requireAdminAuth, async (req, res) => {
    try {
      const { jobs, archiveFinish, archiveDeleted, actionDescription } = req.body;

      await enqueueWrite(async () => {
        if (Array.isArray(jobs)) currentState.jobs = jobs;
        if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
        if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;

        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ jobs: true, archives: true, settings: true });
      });

      broadcast('UPDATE_FINISH_JOB', actionDescription || 'Pekerjaan selesai & diarsipkan', {
        jobsCount: currentState.jobs.length,
        finishCount: currentState.archiveFinish.length,
        deletedCount: currentState.archiveDeleted.length,
      });

      res.json({
        success: true,
        version: currentState.version,
        message: 'Pekerjaan selesai & arsip berhasil diperbarui secara aman',
        data: currentState,
      });
    } catch (err: any) {
      console.error('Error /api/jobs/finish:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Operasi ATOMIK 2: Hapus pekerjaan sekaligus pindahkan ke arsip dalam 1 transaksi
  app.post('/api/jobs/delete', requireAdminAuth, async (req, res) => {
    try {
      const { jobs, archiveDeleted, archiveFinish, actionDescription } = req.body;

      await enqueueWrite(async () => {
        if (Array.isArray(jobs)) currentState.jobs = jobs;
        if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;
        if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;

        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ jobs: true, archives: true, settings: true });
      });

      broadcast('UPDATE_DELETE_JOB', actionDescription || 'Pekerjaan dihapus & dipindahkan ke arsip', {
        jobsCount: currentState.jobs.length,
        finishCount: currentState.archiveFinish.length,
        deletedCount: currentState.archiveDeleted.length,
      });

      res.json({
        success: true,
        version: currentState.version,
        message: 'Pekerjaan dihapus & arsip berhasil diperbarui secara aman',
        data: currentState,
      });
    } catch (err: any) {
      console.error('Error /api/jobs/delete:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Operasi ATOMIK 3: Pulihkan pekerjaan dari arsip kembali ke dashboard dalam 1 transaksi
  app.post('/api/jobs/restore', requireAdminAuth, async (req, res) => {
    try {
      const { jobs, archiveFinish, archiveDeleted, actionDescription } = req.body;

      await enqueueWrite(async () => {
        if (Array.isArray(jobs)) currentState.jobs = jobs;
        if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
        if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;

        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ jobs: true, archives: true, settings: true });
      });

      broadcast('UPDATE_RESTORE_JOB', actionDescription || 'Pekerjaan dipulihkan dari arsip', {
        jobsCount: currentState.jobs.length,
        finishCount: currentState.archiveFinish.length,
        deletedCount: currentState.archiveDeleted.length,
      });

      res.json({
        success: true,
        version: currentState.version,
        message: 'Pekerjaan berhasil dipulihkan dari arsip',
        data: currentState,
      });
    } catch (err: any) {
      console.error('Error /api/jobs/restore:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Update branding logo perusahaan, logo welding, dan poster K3
  app.post('/api/branding', requireAdminAuth, async (req, res) => {
    try {
      const { branding } = req.body;
      if (!branding || typeof branding !== 'object') {
        return res.status(400).json({ success: false, message: 'Format data branding tidak valid' });
      }

      await enqueueWrite(async () => {
        currentState.branding = {
          ...currentState.branding,
          ...branding,
        };
        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ settings: true });
      });

      broadcast('UPDATE_BRANDING', 'Pembaruan gambar logo / poster');

      res.json({
        success: true,
        version: currentState.version,
        message: 'Branding berhasil diperbarui dan disinkronkan ke seluruh perangkat',
        data: currentState,
      });
    } catch (err: any) {
      console.error('Error /api/branding:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Update tanggal acuan dashboard
  app.post('/api/date', requireAdminAuth, async (req, res) => {
    try {
      const { currentDateText, isAutoDate } = req.body;

      await enqueueWrite(async () => {
        if (typeof currentDateText === 'string') currentState.currentDateText = currentDateText;
        if (typeof isAutoDate === 'boolean') currentState.isAutoDate = isAutoDate;

        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ settings: true });
      });

      broadcast('UPDATE_DATE', 'Pembaruan tanggal dashboard');

      res.json({
        success: true,
        version: currentState.version,
        message: 'Tanggal berhasil disinkronkan ke seluruh perangkat',
        data: currentState,
      });
    } catch (err: any) {
      console.error('Error /api/date:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Simpan data lengkap ke server (misal impor file JSON atau sinkronisasi paksa)
  app.post('/api/state', requireAdminAuth, async (req, res) => {
    try {
      const { jobs, archiveFinish, archiveDeleted, pinCode, branding, currentDateText, isAutoDate } = req.body;

      await enqueueWrite(async () => {
        if (Array.isArray(jobs)) currentState.jobs = jobs;
        if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
        if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;
        if (typeof pinCode === 'string' && pinCode) currentState.pinCode = pinCode;
        if (branding && typeof branding === 'object') {
          currentState.branding = {
            ...currentState.branding,
            ...branding,
          };
        }
        if (typeof currentDateText === 'string') currentState.currentDateText = currentDateText;
        if (typeof isAutoDate === 'boolean') currentState.isAutoDate = isAutoDate;

        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({
          jobs: Array.isArray(jobs),
          archives: Array.isArray(archiveFinish) || Array.isArray(archiveDeleted),
          settings: true,
        });
      });

      broadcast('UPDATE_STATE', 'Pembaruan data lengkap dashboard');

      return res.json({
        success: true,
        version: currentState.version,
        message: 'Data berhasil disimpan dan disinkronkan ke seluruh perangkat',
        data: currentState,
      });
    } catch (err: any) {
      console.error('Error saat menyimpan ke /api/state:', err);
      return res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Update data arsip (finish dan deleted)
  app.post('/api/archive', requireAdminAuth, async (req, res) => {
    try {
      const { archiveFinish, archiveDeleted, actionDescription } = req.body;

      await enqueueWrite(async () => {
        if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
        if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;

        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ archives: true, settings: true });
      });

      broadcast('UPDATE_ARCHIVE', actionDescription || 'Pembaruan arsip pekerjaan', {
        finishCount: currentState.archiveFinish.length,
        deletedCount: currentState.archiveDeleted.length,
      });

      res.json({
        success: true,
        version: currentState.version,
        message: 'Arsip berhasil diperbarui dan disinkronkan ke seluruh perangkat',
        data: {
          archiveFinish: currentState.archiveFinish,
          archiveDeleted: currentState.archiveDeleted,
        },
      });
    } catch (err: any) {
      console.error('Error /api/archive:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Update atau verifikasi PIN Keamanan
  app.post('/api/pin', requireAdminAuth, async (req, res) => {
    try {
      const { pinCode } = req.body;
      if (typeof pinCode !== 'string' || pinCode.trim().length < 4) {
        return res.status(400).json({ success: false, message: 'PIN harus berupa minimal 4 digit angka' });
      }

      await enqueueWrite(async () => {
        currentState.pinCode = pinCode.trim();
        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ settings: true });
      });

      broadcast('UPDATE_PIN', 'PIN keamanan diperbarui');

      res.json({
        success: true,
        version: currentState.version,
        message: 'PIN berhasil diperbarui dan disinkronkan ke seluruh perangkat',
      });
    } catch (err: any) {
      console.error('Error /api/pin:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Reset data ke default kosong
  app.post('/api/reset', requireAdminAuth, async (req, res) => {
    try {
      await enqueueWrite(async () => {
        currentState.jobs = DEFAULT_STATE.jobs;
        currentState.currentDateText = getTodayIndonesian();
        currentState.isAutoDate = true;
        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ jobs: true, settings: true });
      });

      broadcast('RESET', 'Reset data pekerjaan ke default');

      res.json({
        success: true,
        version: currentState.version,
        message: 'Data berhasil direset dan disinkronkan ke seluruh perangkat',
        data: currentState,
      });
    } catch (err: any) {
      console.error('Error /api/reset:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  // Vite middleware untuk mode pengembangan (dev) vs penyajian file statis di production
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
