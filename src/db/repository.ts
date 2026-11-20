import { asc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { archivedJobs, dashboardSettings, jobs } from './schema.ts';

export interface DbJobItem {
  id: number;
  deskripsi: string;
  area: string;
  pic?: string;
  start: string;
  finish: string;
  progress_target: number;
  progress_actual: number;
  status: string;
}

export interface DbArchivedJobItem extends DbJobItem {
  archivedAt: string;
  archiveType: 'FINISH' | 'DELETED';
  deleteReason?: string;
}

export interface DbBrandingImages {
  companyLogoUrl: string | null;
  weldingLogoUrl: string | null;
  k3PosterUrl: string | null;
  useCustomK3Image: boolean;
}

export interface DbDashboardState {
  version: number;
  jobs: DbJobItem[];
  archiveFinish: DbArchivedJobItem[];
  archiveDeleted: DbArchivedJobItem[];
  pinCode: string;
  branding: DbBrandingImages;
  currentDateText: string;
  isAutoDate: boolean;
  updatedAt: string;
}

export const DEFAULT_SEED_JOBS: DbJobItem[] = [
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

function sanitizeNumericId(rawId: unknown, fallbackIndex: number): number {
  const num = Number(rawId);
  if (Number.isSafeInteger(num) && num > 0) {
    return num;
  }
  return Date.now() + fallbackIndex;
}

function mapJobRowToItem(row: typeof jobs.$inferSelect): DbJobItem {
  return {
    id: row.id,
    deskripsi: row.deskripsi,
    area: row.area,
    pic: row.pic ?? undefined,
    start: row.startDate,
    finish: row.finishDate,
    progress_target: Number(row.progressTarget) || 0,
    progress_actual: Number(row.progressActual) || 0,
    status: row.status,
  };
}

function mapArchiveRowToItem(row: typeof archivedJobs.$inferSelect): DbArchivedJobItem {
  return {
    id: row.jobId,
    deskripsi: row.deskripsi,
    area: row.area,
    pic: row.pic ?? undefined,
    start: row.startDate,
    finish: row.finishDate,
    progress_target: Number(row.progressTarget) || 0,
    progress_actual: Number(row.progressActual) || 0,
    status: row.status,
    archivedAt: row.archivedAt,
    archiveType: row.archiveType === 'DELETED' ? 'DELETED' : 'FINISH',
    deleteReason: row.deleteReason ?? undefined,
  };
}

async function ensureSettingsRow(tx: any = db) {
  const existing = await tx
    .select()
    .from(dashboardSettings)
    .where(eq(dashboardSettings.id, 1))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const inserted = await tx
    .insert(dashboardSettings)
    .values({
      id: 1,
      version: 1,
      pinCode: '1234',
      companyLogoUrl: null,
      weldingLogoUrl: null,
      k3PosterUrl: null,
      useCustomK3Image: false,
      currentDateText: '20 November 2026',
      isAutoDate: true,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: dashboardSettings.id })
    .returning();

  if (inserted.length > 0) {
    // Seed initial sample jobs only on brand-new database initialization
    const existingJobs = await tx.select({ id: jobs.id }).from(jobs).limit(1);
    if (existingJobs.length === 0) {
      await tx.insert(jobs).values(
        DEFAULT_SEED_JOBS.map((j, idx) => ({
          id: j.id,
          deskripsi: j.deskripsi,
          area: j.area,
          pic: j.pic || null,
          startDate: j.start,
          finishDate: j.finish,
          progressTarget: j.progress_target,
          progressActual: j.progress_actual,
          status: j.status,
          sortOrder: idx,
        }))
      );
    }
    return inserted[0];
  }

  const refetched = await tx
    .select()
    .from(dashboardSettings)
    .where(eq(dashboardSettings.id, 1))
    .limit(1);

  return refetched[0];
}

async function replaceJobsInTx(tx: any, jobList: DbJobItem[], updatedByUid?: string) {
  await tx.delete(jobs);
  if (jobList.length === 0) return;

  const seenIds = new Set<number>();
  const rowsToInsert = jobList.map((j, idx) => {
    let numericId = sanitizeNumericId(j.id, idx + 1);
    while (seenIds.has(numericId)) {
      numericId += 1;
    }
    seenIds.add(numericId);

    return {
      id: numericId,
      deskripsi: String(j.deskripsi || ''),
      area: String(j.area || ''),
      pic: j.pic ? String(j.pic) : null,
      startDate: String(j.start || ''),
      finishDate: String(j.finish || ''),
      progressTarget: Number(j.progress_target) || 0,
      progressActual: Number(j.progress_actual) || 0,
      status: String(j.status || 'AKTIF'),
      sortOrder: idx,
      updatedByUid: updatedByUid || null,
      updatedAt: new Date(),
    };
  });

  await tx.insert(jobs).values(rowsToInsert);
}

async function replaceArchivesInTx(
  tx: any,
  archiveFinish: DbArchivedJobItem[],
  archiveDeleted: DbArchivedJobItem[],
  updatedByUid?: string
) {
  await tx.delete(archivedJobs);

  const combined = [
    ...archiveFinish.map((item) => ({ ...item, archiveType: 'FINISH' as const })),
    ...archiveDeleted.map((item) => ({ ...item, archiveType: 'DELETED' as const })),
  ];

  if (combined.length === 0) return;

  const rowsToInsert = combined.map((item, idx) => ({
    jobId: sanitizeNumericId(item.id, idx + 1),
    deskripsi: String(item.deskripsi || ''),
    area: String(item.area || ''),
    pic: item.pic ? String(item.pic) : null,
    startDate: String(item.start || ''),
    finishDate: String(item.finish || ''),
    progressTarget: Number(item.progress_target) || 0,
    progressActual: Number(item.progress_actual) || 0,
    status: String(item.status || (item.archiveType === 'FINISH' ? 'SELESAI' : 'AKTIF')),
    archiveType: item.archiveType,
    archivedAt: String(item.archivedAt || new Date().toISOString()),
    deleteReason: item.deleteReason ? String(item.deleteReason) : null,
    updatedByUid: updatedByUid || null,
  }));

  await tx.insert(archivedJobs).values(rowsToInsert);
}

async function readFullStateInTx(tx: any): Promise<DbDashboardState> {
  const settings = await ensureSettingsRow(tx);
  const jobRows = await tx
    .select()
    .from(jobs)
    .orderBy(asc(jobs.sortOrder), asc(jobs.id));
  const archiveRows = await tx
    .select()
    .from(archivedJobs)
    .orderBy(asc(archivedJobs.recordId));

  const archiveFinish: DbArchivedJobItem[] = [];
  const archiveDeleted: DbArchivedJobItem[] = [];

  for (const row of archiveRows) {
    const mapped = mapArchiveRowToItem(row);
    if (mapped.archiveType === 'DELETED') {
      archiveDeleted.push(mapped);
    } else {
      archiveFinish.push(mapped);
    }
  }

  return {
    version: settings.version,
    jobs: jobRows.map(mapJobRowToItem),
    archiveFinish,
    archiveDeleted,
    pinCode: settings.pinCode || '1234',
    branding: {
      companyLogoUrl: settings.companyLogoUrl ?? null,
      weldingLogoUrl: settings.weldingLogoUrl ?? null,
      k3PosterUrl: settings.k3PosterUrl ?? null,
      useCustomK3Image: Boolean(settings.useCustomK3Image),
    },
    currentDateText: settings.currentDateText || '20 November 2026',
    isAutoDate: Boolean(settings.isAutoDate),
    updatedAt: settings.updatedAt instanceof Date
      ? settings.updatedAt.toISOString()
      : new Date().toISOString(),
  };
}

export async function getFullDashboardState(): Promise<DbDashboardState> {
  try {
    return await db.transaction(async (tx) => readFullStateInTx(tx));
  } catch (error) {
    console.error('Failed to read dashboard state from database:', error);
    throw new Error('Gagal memuat data dashboard. Silakan coba lagi.', { cause: error });
  }
}

export async function getVersionInfo(): Promise<{ version: number; updatedAt: string }> {
  try {
    const settings = await ensureSettingsRow(db);
    return {
      version: settings.version,
      updatedAt: settings.updatedAt instanceof Date
        ? settings.updatedAt.toISOString()
        : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to fetch dashboard version:', error);
    throw new Error('Gagal memeriksa pembaruan data.', { cause: error });
  }
}

export async function saveJobsList(
  jobList: DbJobItem[],
  updatedByUid?: string
): Promise<DbDashboardState> {
  try {
    return await db.transaction(async (tx) => {
      const settings = await ensureSettingsRow(tx);
      await replaceJobsInTx(tx, jobList, updatedByUid);
      await tx
        .update(dashboardSettings)
        .set({
          version: settings.version + 1,
          updatedByUid: updatedByUid || null,
          updatedAt: new Date(),
        })
        .where(eq(dashboardSettings.id, 1));
      return readFullStateInTx(tx);
    });
  } catch (error) {
    console.error('Failed to save jobs list:', error);
    throw new Error('Gagal menyimpan daftar pekerjaan.', { cause: error });
  }
}

export async function saveJobsAndArchivesAtomic(
  jobList: DbJobItem[] | undefined,
  archiveFinish: DbArchivedJobItem[] | undefined,
  archiveDeleted: DbArchivedJobItem[] | undefined,
  updatedByUid?: string
): Promise<DbDashboardState> {
  try {
    return await db.transaction(async (tx) => {
      const settings = await ensureSettingsRow(tx);
      const current = await readFullStateInTx(tx);

      if (Array.isArray(jobList)) {
        await replaceJobsInTx(tx, jobList, updatedByUid);
      }

      if (Array.isArray(archiveFinish) || Array.isArray(archiveDeleted)) {
        await replaceArchivesInTx(
          tx,
          Array.isArray(archiveFinish) ? archiveFinish : current.archiveFinish,
          Array.isArray(archiveDeleted) ? archiveDeleted : current.archiveDeleted,
          updatedByUid
        );
      }

      await tx
        .update(dashboardSettings)
        .set({
          version: settings.version + 1,
          updatedByUid: updatedByUid || null,
          updatedAt: new Date(),
        })
        .where(eq(dashboardSettings.id, 1));

      return readFullStateInTx(tx);
    });
  } catch (error) {
    console.error('Failed atomic jobs/archives update:', error);
    throw new Error('Gagal menyimpan pembaruan pekerjaan dan arsip.', { cause: error });
  }
}

export async function saveBrandingSettings(
  branding: Partial<DbBrandingImages>,
  updatedByUid?: string
): Promise<DbDashboardState> {
  try {
    return await db.transaction(async (tx) => {
      const settings = await ensureSettingsRow(tx);
      await tx
        .update(dashboardSettings)
        .set({
          companyLogoUrl:
            branding.companyLogoUrl !== undefined
              ? branding.companyLogoUrl
              : settings.companyLogoUrl,
          weldingLogoUrl:
            branding.weldingLogoUrl !== undefined
              ? branding.weldingLogoUrl
              : settings.weldingLogoUrl,
          k3PosterUrl:
            branding.k3PosterUrl !== undefined
              ? branding.k3PosterUrl
              : settings.k3PosterUrl,
          useCustomK3Image:
            typeof branding.useCustomK3Image === 'boolean'
              ? branding.useCustomK3Image
              : settings.useCustomK3Image,
          version: settings.version + 1,
          updatedByUid: updatedByUid || null,
          updatedAt: new Date(),
        })
        .where(eq(dashboardSettings.id, 1));

      return readFullStateInTx(tx);
    });
  } catch (error) {
    console.error('Failed to save branding:', error);
    throw new Error('Gagal menyimpan pengaturan logo dan poster.', { cause: error });
  }
}

export async function saveDateSettings(
  currentDateText: string | undefined,
  isAutoDate: boolean | undefined,
  updatedByUid?: string
): Promise<DbDashboardState> {
  try {
    return await db.transaction(async (tx) => {
      const settings = await ensureSettingsRow(tx);
      await tx
        .update(dashboardSettings)
        .set({
          currentDateText:
            typeof currentDateText === 'string'
              ? currentDateText
              : settings.currentDateText,
          isAutoDate:
            typeof isAutoDate === 'boolean' ? isAutoDate : settings.isAutoDate,
          version: settings.version + 1,
          updatedByUid: updatedByUid || null,
          updatedAt: new Date(),
        })
        .where(eq(dashboardSettings.id, 1));

      return readFullStateInTx(tx);
    });
  } catch (error) {
    console.error('Failed to save date settings:', error);
    throw new Error('Gagal menyimpan pengaturan tanggal.', { cause: error });
  }
}

export async function savePinSetting(
  pinCode: string,
  updatedByUid?: string
): Promise<DbDashboardState> {
  try {
    return await db.transaction(async (tx) => {
      const settings = await ensureSettingsRow(tx);
      await tx
        .update(dashboardSettings)
        .set({
          pinCode: pinCode.trim(),
          version: settings.version + 1,
          updatedByUid: updatedByUid || null,
          updatedAt: new Date(),
        })
        .where(eq(dashboardSettings.id, 1));

      return readFullStateInTx(tx);
    });
  } catch (error) {
    console.error('Failed to save PIN code:', error);
    throw new Error('Gagal menyimpan PIN keamanan.', { cause: error });
  }
}

export async function saveFullDashboardState(
  payload: {
    jobs?: DbJobItem[];
    archiveFinish?: DbArchivedJobItem[];
    archiveDeleted?: DbArchivedJobItem[];
    pinCode?: string;
    branding?: Partial<DbBrandingImages>;
    currentDateText?: string;
    isAutoDate?: boolean;
  },
  updatedByUid?: string
): Promise<DbDashboardState> {
  try {
    return await db.transaction(async (tx) => {
      const settings = await ensureSettingsRow(tx);
      const current = await readFullStateInTx(tx);

      if (Array.isArray(payload.jobs)) {
        await replaceJobsInTx(tx, payload.jobs, updatedByUid);
      }

      if (Array.isArray(payload.archiveFinish) || Array.isArray(payload.archiveDeleted)) {
        await replaceArchivesInTx(
          tx,
          Array.isArray(payload.archiveFinish) ? payload.archiveFinish : current.archiveFinish,
          Array.isArray(payload.archiveDeleted) ? payload.archiveDeleted : current.archiveDeleted,
          updatedByUid
        );
      }

      const branding = payload.branding || {};

      await tx
        .update(dashboardSettings)
        .set({
          pinCode:
            typeof payload.pinCode === 'string' && payload.pinCode.trim()
              ? payload.pinCode.trim()
              : settings.pinCode,
          companyLogoUrl:
            branding.companyLogoUrl !== undefined
              ? branding.companyLogoUrl
              : settings.companyLogoUrl,
          weldingLogoUrl:
            branding.weldingLogoUrl !== undefined
              ? branding.weldingLogoUrl
              : settings.weldingLogoUrl,
          k3PosterUrl:
            branding.k3PosterUrl !== undefined
              ? branding.k3PosterUrl
              : settings.k3PosterUrl,
          useCustomK3Image:
            typeof branding.useCustomK3Image === 'boolean'
              ? branding.useCustomK3Image
              : settings.useCustomK3Image,
          currentDateText:
            typeof payload.currentDateText === 'string'
              ? payload.currentDateText
              : settings.currentDateText,
          isAutoDate:
            typeof payload.isAutoDate === 'boolean'
              ? payload.isAutoDate
              : settings.isAutoDate,
          version: settings.version + 1,
          updatedByUid: updatedByUid || null,
          updatedAt: new Date(),
        })
        .where(eq(dashboardSettings.id, 1));

      return readFullStateInTx(tx);
    });
  } catch (error) {
    console.error('Failed to save full dashboard state:', error);
    throw new Error('Gagal menyimpan seluruh data dashboard.', { cause: error });
  }
}

export async function resetDashboardJobs(
  updatedByUid?: string
): Promise<DbDashboardState> {
  try {
    return await db.transaction(async (tx) => {
      const settings = await ensureSettingsRow(tx);
      await replaceJobsInTx(tx, DEFAULT_SEED_JOBS, updatedByUid);
      await tx
        .update(dashboardSettings)
        .set({
          isAutoDate: true,
          version: settings.version + 1,
          updatedByUid: updatedByUid || null,
          updatedAt: new Date(),
        })
        .where(eq(dashboardSettings.id, 1));

      return readFullStateInTx(tx);
    });
  } catch (error) {
    console.error('Failed to reset dashboard jobs:', error);
    throw new Error('Gagal mereset data pekerjaan.', { cause: error });
  }
}
