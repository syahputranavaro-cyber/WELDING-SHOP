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

const DEFAULT_STATE: ServerState = {
  version: 1,
  jobs: [
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
  ],
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
              jobs: Array.isArray(parsed.jobs) && parsed.jobs.length > 0 ? parsed.jobs : DEFAULT_STATE.jobs,
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

  // === API ROUTES ===
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      version: currentState.version,
      connectedClients: sseClients.size,
      storage: isSupabaseConfigured() ? 'supabase' : 'local',
    });
  });

  // Ambil state lengkap (selalu cek versi terbaru dari Supabase jika aktif)
  app.get('/api/state', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.json({
      success: true,
      version: currentState.version,
      clientCount: sseClients.size,
      data: currentState,
    });
  });

  // Cek versi state (sangat ringan untuk fallback polling & sinkronisasi lintas instance)
  app.get('/api/state/version', async (req, res) => {
    await hydrateOrRefreshFromSupabase(false);
    res.json({
      success: true,
      version: currentState.version,
      clientCount: sseClients.size,
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
  app.post('/api/jobs', async (req, res) => {
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
  app.post('/api/jobs/finish', async (req, res) => {
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
  app.post('/api/jobs/delete', async (req, res) => {
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
  app.post('/api/jobs/restore', async (req, res) => {
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
  app.post('/api/branding', async (req, res) => {
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
  app.post('/api/date', async (req, res) => {
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
  app.post('/api/state', async (req, res) => {
    try {
      const { jobs, archiveFinish, archiveDeleted, pinCode, branding, currentDateText, isAutoDate } = req.body;

      await enqueueWrite(async () => {
        if (Array.isArray(jobs)) currentState.jobs = jobs;
        if (Array.isArray(archiveFinish)) currentState.archiveFinish = archiveFinish;
        if (Array.isArray(archiveDeleted)) currentState.archiveDeleted = archiveDeleted;
        if (typeof pinCode === 'string' && pinCode) currentState.pinCode = pinCode;
        if (branding && typeof branding === 'object') currentState.branding = branding;
        if (typeof currentDateText === 'string') currentState.currentDateText = currentDateText;
        if (typeof isAutoDate === 'boolean') currentState.isAutoDate = isAutoDate;

        currentState.version += 1;
        currentState.updatedAt = new Date().toISOString();
        await commitState({ jobs: true, archives: true, settings: true });
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
  app.post('/api/archive', async (req, res) => {
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
  app.post('/api/pin', async (req, res) => {
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

  // Reset data ke default pabrik
  app.post('/api/reset', async (req, res) => {
    try {
      await enqueueWrite(async () => {
        currentState.jobs = DEFAULT_STATE.jobs;
        currentState.currentDateText = '16 September 2026';
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
